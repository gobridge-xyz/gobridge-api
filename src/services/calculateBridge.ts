import { z } from "zod";
import { getPublicClient, getAdminAccount, getRNKPublicClient } from "../lib/rpc.js";
import { goBridgeManagerAbi, QUOTER_V2_ABI } from "../lib/abi.js";
import { keccak256, toHex, Address, zeroAddress, encodeAbiParameters, stringToBytes, decodeErrorResult, ContractFunctionRevertedError, BaseError, Hex, isHex, parseAbi, parseUnits } from "viem";
import { randomBytes } from "crypto";
import type { PriceService } from "./priceService.js";
import { CFG, ChainKey } from "../config/index.js";

const RNK_GAS = 75_000n;

const G = {
  BASE:              35_000n,
  WRAP_WETH:         27_000n,
  PERMIT2_PULL:      45_000n,
  ALLOW_SET_FIRST:   40_000n,
  ALLOW_SET_STEADY:   8_000n,
  SWAP_FIXED:        55_000n,
  SWAP_PER_HOP:      35_000n,
  BURN:              30_000n,
  EVENT:              3_000n,
};

// ====== Request Schema ======

export const CalcReqSchema = z.object({
  srcInitiator: z.string().regex(/^0x[a-fA-F0-9]{40}$/) as z.ZodType<`0x${string}`>,
  destTo: z.string().regex(/^0x[a-fA-F0-9]{40}$/) as z.ZodType<`0x${string}`>,
  srcChainId: z.number().int().positive() as z.ZodType<number>,
  destChainId: z.number().int().positive() as z.ZodType<number>,
  srcToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/) as z.ZodType<`0x${string}`>,
  destToken: z.string().regex(/^0x[a-fA-F0-9]{40}$/) as z.ZodType<`0x${string}`>,
  amountInRaw: z.union([z.string(), z.number(), z.bigint()]).transform((v) => BigInt(v as any)),
});
export type CalcReq = z.infer<typeof CalcReqSchema>;

function mulDivFloor(a: bigint, b: bigint, d: bigint): bigint {
  return (a * b) / d;
}

type GasShape = {
  isNative: boolean;
  usesPermit2: boolean;
  needsSwap: boolean;
  hopCount: number;
  needsAllowanceWrite: boolean;
  willBurn: boolean;
  inputToken: `0x${string}`;
  expectedMsgValue: bigint;
  minGoUSDEstimate: bigint;
};

type GasFeeQuote = {
  srcBridge: `0x${string}`;
  srcChainId: bigint;
  destChainId: bigint;
  rnk: bigint;
  dest: bigint;
  expiresAt: bigint;
  signature: `0x${string}`;
}

async function fetchGasShape(chainKey: ChainKey, bridgeAddr: Address, abi: any, request: BridgeRequest, srcSwapPath: `0x${string}`, feeQuote: GasFeeQuote): Promise<GasShape> {
  const pc = getPublicClient(chainKey);

  function isDecodedRevert(x: unknown): x is { errorName: string; args?: readonly unknown[] } {
    return !!x && typeof x === "object" && "errorName" in (x as any);
  }

  try {
    const s = await pc.readContract({
      address: bridgeAddr,
      abi,
      functionName: "quoteInitiateBridgeGasShape",
      args: [request, srcSwapPath, feeQuote],
    } as any);

    return s as unknown as GasShape;
  } catch (err) {
    const walked = (err as BaseError).walk?.(
      (e) => e instanceof ContractFunctionRevertedError
    ) as ContractFunctionRevertedError | undefined;

    if (walked) {
      let errorName: string | undefined;
      let errorArgs: readonly unknown[] | undefined;

      const d = (walked as any).data;

      if (typeof d === "string") {
        try {
          const dec = decodeErrorResult({ abi, data: d as Hex });
          errorName = dec.errorName;
          errorArgs = dec.args;
        } catch {
        }
      } else if (isDecodedRevert(d)) {
        errorName = d.errorName;
        errorArgs = d.args;
      }

      if (errorName) {
        if (errorName === "ExceedsMaxValuePerBridge") {
          throw new Error("Bridge quote failed: ExceedsMaxValuePerBridge");
        } else if (errorName === "BelowMinValuePerBridge") {
          throw new Error("Bridge quote failed: BelowMinValuePerBridge");
        }
        throw new Error(
          `Bridge quote reverted: ${errorName}${
            errorArgs?.length ? `(${errorArgs.map(String).join(", ")})` : "()"
          }`
        );
      }

      throw new Error("Bridge quote reverted (unknown custom error)");
    }

    throw err;
  }
}

async function approxGasFromShape(s: GasShape, chainKey: ChainKey) {
  let g = G.BASE + G.BURN + G.EVENT;
  g += s.isNative ? G.WRAP_WETH : G.PERMIT2_PULL;

  if (s.needsSwap) {
    g += G.SWAP_FIXED + BigInt(s.hopCount) * G.SWAP_PER_HOP;
    g += s.needsAllowanceWrite ? G.ALLOW_SET_FIRST : G.ALLOW_SET_STEADY;
  }

  const padded = (g * 170n) / 100n;

  const pc = getPublicClient(chainKey);
  const gasPrice = await pc.getGasPrice().catch(() => null);
  const paddedWei = gasPrice ? padded * gasPrice : null;
  return { approx: g, padded, paddedWei };
}

function max0(x: bigint): bigint {
  return x > 0n ? x : 0n;
}

export function priceToFp(
  price: number | string,
  decimals: number = 8 // 1e8 ölçek (micro USD gibi)
): bigint {
  // price'ı string'e çevirip parseUnits ile güvenli çeviri
  // (parseUnits floating number kabul etmez; string ister)
  const s = typeof price === "number" ? price.toString() : price;
  return parseUnits(s, decimals); // bigint döner
}

function encodeV3Path(tokens: `0x${string}`[], fees: number[]): `0x${string}` {
  if (tokens.length < 2 || fees.length !== tokens.length - 1) throw new Error("invalid path");
  const parts: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    parts.push(...Buffer.from(tokens[i].slice(2), "hex"));
    if (i < fees.length) {
      const f = fees[i];
      if (![100,300,500,3000,10000].includes(f)) throw new Error("bad fee tier");
      parts.push((f >> 16) & 0xff, (f >> 8) & 0xff, f & 0xff);
    }
  }
  return `0x${Buffer.from(Uint8Array.from(parts)).toString("hex")}`;
}

function buildPathToUSDT(chainKey: ChainKey, fromToken: `0x${string}`): `0x${string}` {
  const { usdt, weth, gousd, defaultPoolFee } = CFG.chains[chainKey];
  if (fromToken.toLowerCase() === usdt.toLowerCase()) return "0x";
  if (fromToken.toLowerCase() === gousd.toLowerCase()) {
    return encodeV3Path([fromToken, weth, usdt], [defaultPoolFee, defaultPoolFee]);
  }
  return encodeV3Path([fromToken, usdt], [defaultPoolFee]);
}

function buildSrcPath(chainKey: ChainKey, srcToken: `0x${string}`): `0x${string}` {
  const { weth, gousd, defaultPoolFee } = CFG.chains[chainKey];
  if (srcToken.toLowerCase() === gousd.toLowerCase()) return "0x";
  if (srcToken.toLowerCase() === weth.toLowerCase()) {
    return encodeV3Path([weth, gousd], [defaultPoolFee]);
  }
  return encodeV3Path([srcToken, weth, gousd], [defaultPoolFee, defaultPoolFee]);
}

function buildDstPath(chainKey: ChainKey, dstToken: `0x${string}`): `0x${string}` {
  const { weth, gousd, defaultPoolFee } = CFG.chains[chainKey];
  if (dstToken.toLowerCase() === gousd.toLowerCase()) return "0x";
  if (dstToken.toLowerCase() === weth.toLowerCase()) {
    return encodeV3Path([gousd, weth], [defaultPoolFee]);
  }
  return encodeV3Path([gousd, weth, dstToken], [defaultPoolFee, defaultPoolFee]);
}

function toHexString(raw: unknown): Hex | null {
  if (!raw) return null;
  if (typeof raw === "string") return (isHex(raw) ? (raw as Hex) : null);
  // bazı RPC'ler { data: "0x..." } döndürür
  if (typeof raw === "object" && raw !== null && "data" in raw) {
    const v = (raw as any).data;
    if (typeof v === "string" && isHex(v)) return v as Hex;
    if (v && typeof v !== "string") return toHex(v as any);
  }
  // Uint8Array / bytes
  try { return toHex(raw as any); } catch { return null; }
}

async function getProtocolFeeBps(chainKey: ChainKey): Promise<number> {
  const pc = getPublicClient(chainKey);
  const addr = CFG.chains[chainKey].bridge;
  const abi = parseAbi([
    "function protocolFeeBps() view returns (uint16)"
  ]);

  const bpsBig = await pc.readContract({
    address: addr,
    abi,
    functionName: "protocolFeeBps",
  } as any);

  return Number(bpsBig)
}

export type FeeQuote = {
  rnkFee: bigint;
  destFee: bigint;
  deadline: bigint;
  signature: `0x${string}`;
};

type FeePayload = {
  rnkFee: bigint;
  destFee: bigint;
  deadline: bigint;
}

async function signFeeQuoteDigest(srcChainId: number, dstChainId: number, srcBridge: `0x${string}`, payload: FeePayload): Promise<`0x${string}`> {
  const domain = { name: 'GoBridge', version: '1', chainId: srcChainId, verifyingContract: srcBridge }
  const types  = {
    FeeQuote: [
      { name: 'srcBridge',  type: 'address' },
      { name: 'srcChainId', type: 'uint64'  },
      { name: 'destChainId',type: 'uint64'  },
      { name: 'rnk',        type: 'uint256' },
      { name: 'dest',       type: 'uint256' },
      { name: 'expiresAt',  type: 'uint64'  },
    ],
  }
  const message = { srcBridge, srcChainId: srcChainId, destChainId: dstChainId, rnk: payload.rnkFee, dest: payload.destFee, expiresAt: payload.deadline }
  const signature = await getAdminAccount().signTypedData!({ domain, types, primaryType: 'FeeQuote', message });
  return signature ;
}

// ====== Uniswap simulate + estimate helpers ======
type ExactInputParams = {
  path: `0x${string}`;
  amountIn: bigint;
};

async function quoteExactInput(
  chainKey: ChainKey,
  params: ExactInputParams
) {
  const pc = getPublicClient(chainKey);
  const quoter = CFG.chains[chainKey].quoter;

  const amountOut = await pc.readContract({
    address: quoter,
    abi: QUOTER_V2_ABI,
    functionName: "quoteExactInput",
    args: [params.path, params.amountIn],
  } as any) as bigint;
  
  return amountOut;
}

type BridgeRequest = {
  srcInitiator: `0x${string}`;   // address
  destTo: `0x${string}`;         // address
  srcToken: `0x${string}`;       // address
  destToken: `0x${string}`;      // address
  amountIn: bigint;       // uint256
  minAmountOut: bigint;   // uint256
  destChainId: bigint;    // uint64
};

// Solidity struct BridgePacket
type BridgePacket = {
  requestId: `0x${string}`;      // bytes32
  req: BridgeRequest;     // nested struct
  srcChainId: bigint;     // uint64
  srcNonce: bigint;       // uint128
  srcBridge: `0x${string}`;      // address
  goUSDBurned: bigint;    // uint256
};

// finalizeBridge inputs
type FinalizeBridgeParams = {
  rvmId: `0x${string}`;            // address
  pkt: BridgePacket;        // tuple
  destSwapPath: `0x${string}`;     // bytes
  rnkFee: bigint;           // uint256
  destFee: bigint;          // uint256
};

const RID_TYPEHASH = keccak256(stringToBytes("GoBridge::BridgeRequest_V1"));

function rid(
  r: BridgeRequest,
  burned: bigint,
  srcChainId: bigint, // uint64
  srcBridge: `0x${string}`,
  nonce: bigint,
): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" }, // RID_TYPEHASH
        { type: "address" }, // srcInitiator
        { type: "address" }, // destTo
        { type: "address" }, // srcToken
        { type: "address" }, // destToken
        { type: "uint256" }, // amountIn
        { type: "uint256" }, // burned
        { type: "uint256" }, // minAmountOut
        { type: "uint64" },  // destChainId
        { type: "uint128" }, // n
        { type: "uint64" },  // srcChainId
        { type: "address" }, // srcBridge
      ],
      [
        RID_TYPEHASH,
        r.srcInitiator,
        r.destTo,
        r.srcToken,
        r.destToken,
        r.amountIn,
        burned,
        r.minAmountOut,
        r.destChainId,
        nonce,
        srcChainId,
        srcBridge,
      ],
    )
  );
}

type DecodedErr = { errorName: string; args: readonly unknown[] };

async function estimateDstFinalizeGas(
  chainKey: ChainKey,
  from: `0x${string}`,
  p: FinalizeBridgeParams
) {
  const pc = getPublicClient(chainKey);
  const addr = CFG.chains[chainKey].bridge;
  if (!addr) return { gas: null, fee: null, error: { short: "missing bridgeFinalizer" } };

  try {
    const gas = await pc.estimateContractGas({
      address: addr,
      abi: goBridgeManagerAbi,
      functionName: "finalizeBridge",
      args: [p.rvmId, p.pkt, p.destSwapPath, p.rnkFee, p.destFee],
      account: from,
    });
    const fees = await pc.estimateFeesPerGas().catch(() => null);
    const eff = fees?.maxFeePerGas ?? await pc.getGasPrice();
    const fee = eff ? gas * eff : null;
    return { gas, fee };
  } catch (err: any) {
    let short: string | undefined;
    let reason: string | undefined;
    let rawHex: Hex | null = null;
    let decoded: DecodedErr | null = null;

    if (err instanceof BaseError) {
      short = err.shortMessage;
      const rev = err.walk(e => e instanceof ContractFunctionRevertedError) as ContractFunctionRevertedError | undefined;
      reason = rev?.reason;
      rawHex =
        toHexString((rev as any)?.data) ??
        toHexString((rev as any)?.cause?.data);

      if (rawHex) {
        try {
          const d = decodeErrorResult({ abi: goBridgeManagerAbi, data: rawHex });
          decoded = { errorName: d.errorName, args: d.args ?? [] as const };
        } catch {
          short = short ?? `unknown selector: ${rawHex.slice(0, 10)}`;
        }
      }
    } else {
      short = String(err);
    }

    console.error("estimateDstFinalizeGas error ->", {
      short,
      reason,
      rawHex,
      decoded: decoded
        ? { errorName: decoded.errorName, args: Array.from(decoded.args) }
        : null,
    });

    return {
      gas: null,
      fee: null,
      error: {
        short,
        reason,
        raw: rawHex ?? undefined,
        decoded: decoded
          ? { errorName: decoded.errorName, args: Array.from(decoded.args) }
          : undefined,
      },
    };
  }
}

// ====== Main calculate ======
export type CalcOut = {
  srcSwapPath: `0x${string}`;
  dstSwapPath: `0x${string}`;
  protocolFee: bigint;
  srcFee: bigint;
  totalFees: bigint;
  amountOutAfterFees: bigint;
  minAmountOut: bigint;
  feeQuote: FeeQuote;
};

export async function calculateBridge(req: CalcReq, priceService: PriceService): Promise<CalcOut> {
  const srcChainKey = Object.keys(CFG.chains).find(k => CFG.chains[k as ChainKey].chain.id === req.srcChainId) as ChainKey | undefined;
  const destChainKey = Object.keys(CFG.chains).find(k => CFG.chains[k as ChainKey].chain.id === req.destChainId) as ChainKey | undefined;

  if (!srcChainKey || !destChainKey) {
    throw new Error("Invalid chain ID");
  }

  const src = CFG.chains[srcChainKey];
  const dst = CFG.chains[destChainKey];
  const now = BigInt(Math.floor(Date.now() / 1000));
  const deadline = now + 1800n;

  if (req.srcToken.toLowerCase() === zeroAddress) {
    req.srcToken = src.weth;
  }

  if (req.destToken.toLowerCase() === zeroAddress) {
    req.destToken = dst.weth;
  }

  // 1) PATH’LER
  const srcSwapPath = buildSrcPath(srcChainKey, req.srcToken);
  const dstSwapPath = buildDstPath(destChainKey, req.destToken);

  // 2) SRC simulate + estimateGas -> srcOutAmount (goUSD)
  let srcOutAmount = req.amountInRaw;
  if (srcSwapPath !== "0x") {
    const amountOut = await quoteExactInput(
      srcChainKey,
      {
        path: srcSwapPath,
        amountIn: req.amountInRaw,
      }
    );
    srcOutAmount = amountOut;
  }

  const nonce = BigInt('0x' + randomBytes(16).toString('hex'));

  const requestId = rid(
    {
      srcInitiator: req.srcInitiator,
      destTo: req.destTo,
      srcToken: req.srcToken,
      destToken: req.destToken,
      amountIn: req.amountInRaw,
      minAmountOut: 0n,
      destChainId: BigInt(dst.chain.id),
    },
    srcOutAmount,
    BigInt(src.chain.id),
    src.bridge,
    nonce
  );

  // 3) DST estimateGas
  let { gas: dstGas, fee: dstFeeWei, error: dstErr } = await estimateDstFinalizeGas(destChainKey, dst.rnProxy,
    {
      rvmId: getAdminAccount().address,
      pkt: {
        requestId: requestId,
        req: {
          srcInitiator: req.srcInitiator,
          destTo: req.destTo,
          srcToken: req.srcToken,
          destToken: req.destToken,
          amountIn: req.amountInRaw,
          minAmountOut: 0n,
          destChainId: BigInt(dst.chain.id),
        },
        srcChainId: BigInt(src.chain.id),
        srcNonce: nonce,
        srcBridge: src.bridge,
        goUSDBurned: srcOutAmount,
      },
      destSwapPath: dstSwapPath,
      rnkFee: 10n,
      destFee: 10n,
    }
  );
  
  if (dstFeeWei === null) {
    throw new Error(dstErr?.decoded?.errorName
      ? `dst finalizeBridge error: ${dstErr.decoded.errorName}(${dstErr.decoded.args.join(", ")})`
      : dstErr?.reason
        ? `dst finalizeBridge reverted: ${dstErr.reason}`
        : dstErr?.short
          ? `dst finalizeBridge estimate failed: ${dstErr.short}`
          : "dst finalizeBridge estimate failed");
  }

  dstFeeWei = (dstFeeWei * 15_000n) / 10_000n;

  const price = await getRNKPublicClient().getGasPrice()
  const rnkWei = price ? price * RNK_GAS : 100001000000n * RNK_GAS;

  if (!priceService.get("REACT")?.usd || !priceService.get("ETH")?.usd) {
    throw new Error("RNK or ETH price not available");
  }

  const rnkUsd18 = priceToFp(priceService.get("REACT")!.usd, 18);
  const ethUsd18 = priceToFp(priceService.get("ETH")!.usd, 18);

  const rnkFeeUsd18 = mulDivFloor(rnkWei, rnkUsd18, 10n ** 18n); // RNK gas fee (USD18)
  const dstFeeUsd18 = mulDivFloor(dstFeeWei, ethUsd18, 10n ** 18n);

  const feeQuote: FeeQuote = {
    rnkFee: rnkFeeUsd18,   // USD18
    destFee: dstFeeUsd18,  // USD18
    deadline: deadline,
    signature: "0x",
  };
  feeQuote.signature = await signFeeQuoteDigest(src.chain.id, dst.chain.id, src.bridge, feeQuote);

  // 4) DST simulate + estimateGas (dstSwapPath ile, amountIn = srcOutAmount) -> outAmount
  let outAmount = srcOutAmount;
  if (dstSwapPath !== "0x") {
    const amountOut= await quoteExactInput(
      destChainKey,
      {
        path: dstSwapPath,
        amountIn: srcOutAmount,
      }
    );
    outAmount = amountOut;
  }

  const dstUSDPath = buildPathToUSDT(destChainKey, req.destToken);
  const dstUSDValue6 = await quoteExactInput(destChainKey, {
    path: dstUSDPath,
    amountIn: outAmount,
  });

  if (dstUSDValue6 === 0n) {
    throw new Error("Destination USD value is zero");
  }

  const dstUSDValue18 = dstUSDValue6 * 10n ** 12n;
  const protocolFeeBps = await getProtocolFeeBps(destChainKey);

  const s = await fetchGasShape(
    srcChainKey,
    src.bridge,
    goBridgeManagerAbi,
    {
      ...req,
      amountIn: req.amountInRaw,
      minAmountOut: req.amountInRaw,
      destChainId: BigInt(dst.chain.id),
    } as BridgeRequest,
    srcSwapPath,
    {
      srcBridge: src.bridge,
      srcChainId: BigInt(src.chain.id),
      destChainId: BigInt(dst.chain.id),
      rnk: feeQuote.rnkFee,
      dest: feeQuote.destFee,
      expiresAt: feeQuote.deadline,
      signature: feeQuote.signature,
    } as GasFeeQuote
  );
  const { paddedWei: prePermitGasLimit } = await approxGasFromShape(s, srcChainKey);

  if (prePermitGasLimit === null) {
    throw new Error("prePermitGasLimit estimate failed");
  }

  const srcFee = mulDivFloor(prePermitGasLimit, ethUsd18, 10n ** 18n);

  const protocolFee = protocolFeeBps > 0 ? (srcOutAmount * BigInt(protocolFeeBps) / 10_000n) : 0n;

  const totalFees = rnkFeeUsd18 + dstFeeUsd18 + protocolFee;

  const amountOutAfterFeesUSD18 = max0(dstUSDValue18 - totalFees);
  const amountOutAfterFees = (dstUSDValue18 === 0n)
    ? 0n
    : mulDivFloor(outAmount, amountOutAfterFeesUSD18, dstUSDValue18);

  // 6) minAmountOut = amountOutAfterFees * 0.94
  const minAmountOut = (amountOutAfterFees * 94n) / 100n;

  return {
    srcSwapPath,
    dstSwapPath,
    feeQuote,
    srcFee,
    protocolFee,
    totalFees,
    amountOutAfterFees,
    minAmountOut,
  };
}
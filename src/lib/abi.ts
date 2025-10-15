import type { Abi } from 'viem'

export const ERC20_ABI = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] } // 👈 eklendi
] as const;

// SwapRouter02 exactInput(params)
export const QUOTER_V2_ABI = [
  {
    type: "function",
    name: "quoteExactInput",
    stateMutability: "view",
    inputs: [
      { name: "path", type: "bytes" },
      { name: "amountIn", type: "uint256" }
    ],
    outputs: [
      { name: "amountOut", type: "uint256" }
    ]
  }
] as const;

export const goBridgeManagerAbi = [
  // ERRORS
  { inputs: [], name: 'BelowMinValuePerBridge', type: 'error' },
  { inputs: [], name: 'ECDSAInvalidSignature', type: 'error' },
  { inputs: [], name: 'EnforcedPause', type: 'error' },
  { inputs: [], name: 'ErrBadSignature', type: 'error' },
  { inputs: [], name: 'ErrDestEqSrc', type: 'error' },
  { inputs: [], name: 'ErrFeesTooHigh', type: 'error' },
  { inputs: [], name: 'ErrFinalized', type: 'error' },
  { inputs: [], name: 'ErrPercentTooHigh', type: 'error' },
  { inputs: [], name: 'ErrQuoteExpired', type: 'error' },
  { inputs: [], name: 'ExceedsMaxValuePerBridge', type: 'error' },
  { inputs: [], name: 'ExpectedPause', type: 'error' },
  { inputs: [], name: 'InvalidParams', type: 'error' },
  { inputs: [], name: 'InvalidShortString', type: 'error' },
  { inputs: [], name: 'InvalidSwapData', type: 'error' },
  { inputs: [], name: 'OracleError', type: 'error' },
  { inputs: [], name: 'Permit2Error', type: 'error' },
  { inputs: [], name: 'ReentrancyGuardReentrantCall', type: 'error' },

  // EVENTS
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'requestId', type: 'bytes32' },
      { indexed: false, internalType: 'address', name: 'to', type: 'address' },
      { indexed: false, internalType: 'address', name: 'destToken', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amountOut', type: 'uint256' },
    ],
    name: 'BridgeFinalized',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'bytes32', name: 'requestId', type: 'bytes32' },
      { indexed: true, internalType: 'uint64', name: 'srcChainId', type: 'uint64' },
      { indexed: true, internalType: 'uint64', name: 'destChainId', type: 'uint64' },
      { indexed: false, internalType: 'bytes', name: 'destSwapPath', type: 'bytes' },
      { indexed: false, internalType: 'address', name: 'srcBridge', type: 'address' },
      { indexed: false, internalType: 'uint128', name: 'srcNonce', type: 'uint128' },
      { indexed: false, internalType: 'address', name: 'srcInitiator', type: 'address' },
      { indexed: false, internalType: 'address', name: 'destTo', type: 'address' },
      { indexed: false, internalType: 'address', name: 'srcToken', type: 'address' },
      { indexed: false, internalType: 'address', name: 'destToken', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'srcAmountIn', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'goUSDBurned', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'minAmountOut', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'rnkFee', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'destFee', type: 'uint256' },
    ],
    name: 'BridgeInitialized',
    type: 'event',
  },

  // finalizeBridge(rvmId, pkt, destSwapPath, rnkFee, destFee)
  {
    inputs: [
      { internalType: 'address', name: 'rvmId', type: 'address' },
      {
        components: [
          { internalType: 'bytes32', name: 'requestId', type: 'bytes32' },
          {
            components: [
              { internalType: 'address', name: 'srcInitiator', type: 'address' },
              { internalType: 'address', name: 'destTo', type: 'address' },
              { internalType: 'address', name: 'srcToken', type: 'address' },
              { internalType: 'address', name: 'destToken', type: 'address' },
              { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
              { internalType: 'uint256', name: 'minAmountOut', type: 'uint256' },
              { internalType: 'uint64', name: 'destChainId', type: 'uint64' },
            ],
            internalType: 'struct BridgeTypes.BridgeRequest',
            name: 'req',
            type: 'tuple',
          },
          { internalType: 'uint64', name: 'srcChainId', type: 'uint64' },
          { internalType: 'uint128', name: 'srcNonce', type: 'uint128' },
          { internalType: 'address', name: 'srcBridge', type: 'address' },
          { internalType: 'uint256', name: 'goUSDBurned', type: 'uint256' },
        ],
        internalType: 'struct BridgeTypes.BridgePacket',
        name: 'pkt',
        type: 'tuple',
      },
      { internalType: 'bytes', name: 'destSwapPath', type: 'bytes' },
      { internalType: 'uint256', name: 'rnkFee', type: 'uint256' },
      { internalType: 'uint256', name: 'destFee', type: 'uint256' },
    ],
    name: 'finalizeBridge',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },

  // initiateBridge(request, permit, srcSwapPath, destSwapPath, feeQuote) => (bytes32)
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'srcInitiator', type: 'address' },
          { internalType: 'address', name: 'destTo', type: 'address' },
          { internalType: 'address', name: 'srcToken', type: 'address' },
          { internalType: 'address', name: 'destToken', type: 'address' },
          { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
          { internalType: 'uint256', name: 'minAmountOut', type: 'uint256' },
          { internalType: 'uint64', name: 'destChainId', type: 'uint64' },
        ],
        internalType: 'struct BridgeTypes.BridgeRequest',
        name: 'request',
        type: 'tuple',
      },
      {
        components: [
          { internalType: 'address', name: 'owner', type: 'address' },
          { internalType: 'uint256', name: 'nonce', type: 'uint256' },
          { internalType: 'uint256', name: 'deadline', type: 'uint256' },
          { internalType: 'bytes', name: 'signature', type: 'bytes' },
        ],
        internalType: 'struct BridgeTypes.Permit2Data',
        name: 'permit',
        type: 'tuple',
      },
      { internalType: 'bytes', name: 'srcSwapPath', type: 'bytes' },
      { internalType: 'bytes', name: 'destSwapPath', type: 'bytes' },
      {
        components: [
          { internalType: 'address', name: 'srcBridge', type: 'address' },
          { internalType: 'uint64', name: 'srcChainId', type: 'uint64' },
          { internalType: 'uint64', name: 'destChainId', type: 'uint64' },
          { internalType: 'uint256', name: 'rnk', type: 'uint256' },
          { internalType: 'uint256', name: 'dest', type: 'uint256' },
          { internalType: 'uint64', name: 'expiresAt', type: 'uint64' },
          { internalType: 'bytes', name: 'signature', type: 'bytes' },
        ],
        internalType: 'struct BridgeTypes.FeeQuote',
        name: 'feeQuote',
        type: 'tuple',
      },
    ],
    name: 'initiateBridge',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'payable',
    type: 'function',
  },

  // quoteInitiateBridgeGasShape(request, srcSwapPath, feeQuote) => (GasShape s)
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'srcInitiator', type: 'address' },
          { internalType: 'address', name: 'destTo', type: 'address' },
          { internalType: 'address', name: 'srcToken', type: 'address' },
          { internalType: 'address', name: 'destToken', type: 'address' },
          { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
          { internalType: 'uint256', name: 'minAmountOut', type: 'uint256' },
          { internalType: 'uint64', name: 'destChainId', type: 'uint64' },
        ],
        internalType: 'struct BridgeTypes.BridgeRequest',
        name: 'request',
        type: 'tuple',
      },
      { internalType: 'bytes', name: 'srcSwapPath', type: 'bytes' },
      {
        components: [
          { internalType: 'address', name: 'srcBridge', type: 'address' },
          { internalType: 'uint64', name: 'srcChainId', type: 'uint64' },
          { internalType: 'uint64', name: 'destChainId', type: 'uint64' },
          { internalType: 'uint256', name: 'rnk', type: 'uint256' },
          { internalType: 'uint256', name: 'dest', type: 'uint256' },
          { internalType: 'uint64', name: 'expiresAt', type: 'uint64' },
          { internalType: 'bytes', name: 'signature', type: 'bytes' },
        ],
        internalType: 'struct BridgeTypes.FeeQuote',
        name: 'feeQuote',
        type: 'tuple',
      },
    ],
    name: 'quoteInitiateBridgeGasShape',
    outputs: [
      {
        components: [
          { internalType: 'bool', name: 'isNative', type: 'bool' },
          { internalType: 'bool', name: 'usesPermit2', type: 'bool' },
          { internalType: 'bool', name: 'needsSwap', type: 'bool' },
          { internalType: 'uint8', name: 'hopCount', type: 'uint8' },
          { internalType: 'bool', name: 'needsAllowanceWrite', type: 'bool' },
          { internalType: 'bool', name: 'willBurn', type: 'bool' },
          { internalType: 'address', name: 'inputToken', type: 'address' },
          { internalType: 'uint256', name: 'minGoUSDEstimate', type: 'uint256' },
          { internalType: 'uint256', name: 'expectedMsgValue', type: 'uint256' },
        ],
        internalType: 'struct GoBridgeManager_V1.GasShape',
        name: 's',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const satisfies Abi
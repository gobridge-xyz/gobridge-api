import { createPublicClient, http, Hex, defineChain, createWalletClient, Account } from "viem";
import { mainnet, arbitrum, base } from "viem/chains";
import { ChainId } from "./registry";
import { privateKeyToAccount } from "viem/accounts";

const chainMap: Record<ChainId, any> = {
  1: mainnet,
  42161: arbitrum,
  8453: base,
};

const rnk = defineChain({
  id: 1597,
  name: 'Reactive Mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'REACT',
    symbol: 'REACT',
  },
  rpcUrls: {
    default: {
      http: ['https://mainnet-rpc.rnk.dev/'],
    },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: 'https://reactscan.net/' },
  },
})

function rpcUrl(id: ChainId): string {
  const envKey = `RPC_${id}` as const;
  const url = process.env[envKey] || process.env.RPC_1;
  if (!url) throw new Error(`Missing RPC for chainId=${id}`);
  return url;
}

export function getPublicClient(chainId: ChainId) {
  const chain = chainMap[chainId] ?? defineChain({ id: chainId, name: `chain-${chainId}`, nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [rpcUrl(chainId)] } }});
  return createPublicClient({ chain, transport: http(rpcUrl(chainId)) });
}

export function getRNKPublicClient() {
  return createPublicClient({ chain: rnk, transport: http() });
}

export function getAdminAccount(): Account {
  const pk = process.env.ADMIN_PK as Hex;
  const account = privateKeyToAccount(pk);
  return account;
}

export function getAdminWallet(chainId: ChainId) {
  const pk = process.env.ADMIN_PK as Hex | undefined;
  if (!pk) return null;
  const chain = chainMap[chainId];
  const account = privateKeyToAccount(pk);
  return createWalletClient({ account, chain, transport: http(rpcUrl(chainId)) });
}
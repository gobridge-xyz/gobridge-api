import { createPublicClient, http, Hex, defineChain, createWalletClient, Account, webSocket } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ChainKey, CFG } from "../config/index"

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

export function getPublicClient(chainKey: ChainKey) {
  return createPublicClient({ chain: CFG.chains[chainKey].chain, transport: http() });
}

export function getWSClient(chainKey: ChainKey) {
  return createPublicClient({ chain: CFG.chains[chainKey].chain, transport: webSocket() });
}

export function getRNKPublicClient() {
  return createPublicClient({ chain: rnk, transport: http() });
}

export function getAdminAccount(): Account {
  const pk = process.env.ADMIN_PK as Hex;
  const account = privateKeyToAccount(pk);
  return account;
}

export function getAdminWallet(chainKey: ChainKey) {
  const pk = process.env.ADMIN_PK as Hex | undefined;
  if (!pk) return null;
  const chain = CFG.chains[chainKey].chain;
  const account = privateKeyToAccount(pk);
  return createWalletClient({ account, chain, transport: http() });
}
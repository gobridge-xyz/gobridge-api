import 'dotenv/config';
import { Chain, defineChain } from 'viem';

export type ChainKey = "base" | "arb" | "mainnet";
export const CFG = {
  chains: {
    base: {
      chain: defineChain({
        id: 8453,
        name: 'Base',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: {
          default: { http: [process.env.RPC_BASE!], webSocket: [process.env.RPC_WS_BASE!] },
        },
        blockExplorers: {
          default: { name: 'Basescan', url: 'https://basescan.org' },
        },
        contracts: {
          multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11', blockCreated: 5022 },
        }
      }),

      deploymentBlock: 36347715n,
      pool: process.env.POOL_BASE as `0x${string}`,
      bridge: process.env.BRIDGE_BASE as `0x${string}`,
      
      permit2: process.env.PERMIT2_BASE as `0x${string}`,
      quoter: process.env.QUOTER_BASE as `0x${string}`,
      defaultPoolFee: 500,

      rnProxy: process.env.RN_PROXY_BASE as `0x${string}`,

      weth: process.env.WETH_BASE as `0x${string}`,
      gousd: process.env.GOUSD_BASE as `0x${string}`,
      usdt: process.env.USDT_BASE as `0x${string}`,
    },
    arb: {
      chain: defineChain({
        id: 42161,
        name: 'Arbitrum One',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: {
          default: { http: [process.env.RPC_ARB!], webSocket: [process.env.RPC_WS_ARB!] },
        },
        blockExplorers: {
          default: { name: 'Arbiscan', url: 'https://arbiscan.io' },
        },
        contracts: {
          multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11', blockCreated: 7654707 },
        }
      }),

      deploymentBlock: 385594691n,
      pool: process.env.POOL_GOUSD_ARB as `0x${string}`,
      bridge: process.env.BRIDGE_ARB as `0x${string}`,
      
      permit2: process.env.PERMIT2_ARB as `0x${string}`,
      quoter: process.env.QUOTER_ARB as `0x${string}`,
      defaultPoolFee: 500,

      rnProxy: process.env.RN_PROXY_ARB as `0x${string}`,

      weth: process.env.WETH_ARB as `0x${string}`,
      gousd: process.env.GOUSD_ARB as `0x${string}`,
      usdt: process.env.USDT_ARB as `0x${string}`,
    },
    mainnet: {
      chain: defineChain({
        id: 1,
        name: 'Ethereum Mainnet',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: {
          default: { http: [process.env.RPC_MAINNET!], webSocket: [process.env.RPC_WS_MAINNET!] },
        },
        blockExplorers: {
          default: { name: 'Etherscan', url: 'https://etherscan.io' },
        },
        contracts: {
          multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11', blockCreated: 14353601 },
        }
      }),

      deploymentBlock: 23496433n,
      pool: process.env.POOL_MAINNET as `0x${string}`,
      bridge: process.env.BRIDGE_MAINNET as `0x${string}`,
      
      permit2: process.env.PERMIT2_MAINNET as `0x${string}`,
      quoter: process.env.QUOTER_MAINNET as `0x${string}`,
      defaultPoolFee: 500,

      rnProxy: process.env.RN_PROXY_MAINNET as `0x${string}`,

      weth: process.env.WETH_MAINNET as `0x${string}`,
      gousd: process.env.GOUSD_MAINNET as `0x${string}`,
      usdt: process.env.USDT_MAINNET as `0x${string}`,
    },
  } as Record<ChainKey, {
    chain: Chain;
  
    // GoBridge
    deploymentBlock: bigint,
    pool: `0x${string}`;
    bridge: `0x${string}`;

    // Uniswap
    permit2: `0x${string}`;
    quoter: `0x${string}`;
    defaultPoolFee: 500 | 3000 | 10000;

    // Reactive Network
    rnProxy: `0x${string}`;

    // Tokens
    weth: `0x${string}`;
    gousd: `0x${string}`;
    usdt: `0x${string}`;
  }>,
};
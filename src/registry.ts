export type ChainId = 1 | 42161 | 8453;

type Reg = {
  WETH: `0x${string}`;
  goUSD: `0x${string}`;
  USDT: `0x${string}`;
  quoterV2: `0x${string}`;
  bridge: `0x${string}`;
  defaultPoolFee: 500 | 3000 | 10000; // Uniswap Fee Tier (ör. 500 = 0.05%)
  permit2: `0x${string}`; // 0x000000000022d473030f116ddee9f6b43ac78ba3
  proxy: `0x${string}`; // optional, can be null
};

export const REGISTRY: Record<ChainId, Reg> = {
  1: {
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    goUSD: "0xaDD290D9262768C039ca8Ce6013C7F2F20DD24c0", // TODO
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    quoterV2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
    bridge: "0x3Cf8F4abA78848012d9Ba3D4f3B543669287107B", // TODO
    defaultPoolFee: 500,
    permit2: "0x000000000022d473030f116ddee9f6b43ac78ba3",
    proxy: "0x1D5267C1bb7D8bA68964dDF3990601BDB7902D76",
  },
  8453: {
    WETH: "0x4200000000000000000000000000000000000006",
    goUSD: "0xaDD290D9262768C039ca8Ce6013C7F2F20DD24c0", // TODO
    USDT: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    quoterV2: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a",
    bridge: "0x274Df598AcA76e85a7a3A3c5a09ce076Cded3EAE", // TODO
    defaultPoolFee: 500,
    permit2: "0x000000000022d473030f116ddee9f6b43ac78ba3",
    proxy: "0x0D3E76De6bC44309083cAAFdB49A088B8a250947",
  },
  42161: {
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    goUSD: "0xaDD290D9262768C039ca8Ce6013C7F2F20DD24c0", // TODO
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    quoterV2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
    bridge: "0x8601df7a871FAB7Ff7513AC95Cc7bd005326FAa5", // TODO
    defaultPoolFee: 500,
    permit2: "0x000000000022d473030f116ddee9f6b43ac78ba3",
    proxy: "0x4730c58FDA9d78f60c987039aEaB7d261aAd942E",
  },
};
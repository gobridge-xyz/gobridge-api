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

export const BRIDGE_FINALIZER_ABI = [
  { type: "error", name: "InvalidParams", inputs: [] },
  { type: "error", name: "InvalidSwapData", inputs: [] },
  { type: "error", name: "Permit2Error", inputs: [] },
  { type: "error", name: "ErrDestEqSrc", inputs: [] },
  { type: "error", name: "ErrFinalized", inputs: [] },
  { type: "error", name: "OracleError", inputs: [] },
  { type: "error", name: "ErrFeesTooHigh", inputs: [] },
  { type: "error", name: "ErrQuoteExpired", inputs: [] },
  { type: "error", name: "ErrBadSignature", inputs: [] },
  { type: "error", name: "ErrPercentTooHigh", inputs: [] },
  { type: "error", name: "BelowMinValuePerBridge", inputs: [] },
  { type: "error", name: "ExceedsMaxValuePerBridge", inputs: [] },
  {
    type: "function",
    name: "finalizeBridge",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "rvmId",
        type: "address",
        internalType: "address",
      },
      {
        name: "pkt",
        type: "tuple",
        internalType: "struct BridgeTypes.BridgePacket",
        components: [
          {
            name: "requestId",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "req",
            type: "tuple",
            internalType: "struct BridgeTypes.BridgeRequest",
            components: [
              { name: "srcInitiator", type: "address", internalType: "address" },
              { name: "destTo", type: "address", internalType: "address" },
              { name: "srcToken", type: "address", internalType: "address" },
              { name: "destToken", type: "address", internalType: "address" },
              { name: "amountIn", type: "uint256", internalType: "uint256" },
              { name: "minAmountOut", type: "uint256", internalType: "uint256" },
              { name: "destChainId", type: "uint64", internalType: "uint64" },
            ],
          },
          { name: "srcChainId", type: "uint64", internalType: "uint64" },
          { name: "srcNonce", type: "uint128", internalType: "uint128" },
          { name: "srcBridge", type: "address", internalType: "address" },
          { name: "goUSDBurned", type: "uint256", internalType: "uint256" },
        ],
      },
      {
        name: "destSwapPath",
        type: "bytes",
        internalType: "bytes",
      },
      {
        name: "rnkFee",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "destFee",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
  },
] as const;

export const BRIDGE_QUOTE_ABI = [
  { type: "error", name: "InvalidParams", inputs: [] },
  { type: "error", name: "InvalidSwapData", inputs: [] },
  { type: "error", name: "Permit2Error", inputs: [] },
  { type: "error", name: "ErrDestEqSrc", inputs: [] },
  { type: "error", name: "ErrFinalized", inputs: [] },
  { type: "error", name: "OracleError", inputs: [] },
  { type: "error", name: "ErrFeesTooHigh", inputs: [] },
  { type: "error", name: "ErrQuoteExpired", inputs: [] },
  { type: "error", name: "ErrBadSignature", inputs: [] },
  { type: "error", name: "ErrPercentTooHigh", inputs: [] },
  { type: "error", name: "BelowMinValuePerBridge", inputs: [] },
  { type: "error", name: "ExceedsMaxValuePerBridge", inputs: [] },
  {
    inputs: [
      {
        components: [
          { internalType: "address", name: "srcInitiator", type: "address" },
          { internalType: "address", name: "destTo", type: "address" },
          { internalType: "address", name: "srcToken", type: "address" },
          { internalType: "address", name: "destToken", type: "address" },
          { internalType: "uint256", name: "amountIn", type: "uint256" },
          { internalType: "uint256", name: "minAmountOut", type: "uint256" },
          { internalType: "uint64", name: "destChainId", type: "uint64" }
        ],
        internalType: "struct BridgeTypes.BridgeRequest",
        name: "request",
        type: "tuple"
      },
      { internalType: "bytes", name: "srcSwapPath", type: "bytes" },
      {
        components: [
          { internalType: "address", name: "srcBridge", type: "address" },
          { internalType: "uint64", name: "srcChainId", type: "uint64" },
          { internalType: "uint64", name: "destChainId", type: "uint64" },
          { internalType: "uint256", name: "rnk", type: "uint256" },
          { internalType: "uint256", name: "dest", type: "uint256" },
          { internalType: "uint64", name: "expiresAt", type: "uint64" },
          { internalType: "bytes", name: "signature", type: "bytes" }
        ],
        internalType: "struct BridgeTypes.FeeQuote",
        name: "feeQuote",
        type: "tuple"
      }
    ],
    name: "quoteInitiateBridgeGasShape",
    outputs: [
      {
        components: [
          { internalType: "bool", name: "isNative", type: "bool" },
          { internalType: "bool", name: "usesPermit2", type: "bool" },
          { internalType: "bool", name: "needsSwap", type: "bool" },
          { internalType: "uint8", name: "hopCount", type: "uint8" },
          { internalType: "bool", name: "needsAllowanceWrite", type: "bool" },
          { internalType: "bool", name: "willBurn", type: "bool" },
          { internalType: "address", name: "inputToken", type: "address" },
          { internalType: "uint256", name: "minGoUSDEstimate", type: "uint256" },
          { internalType: "uint256", name: "expectedMsgValue", type: "uint256" }
        ],
        internalType: "struct GoBridgeManager_V1.GasShape",
        name: "s",
        type: "tuple"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const;
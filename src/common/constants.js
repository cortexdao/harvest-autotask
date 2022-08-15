// Safes
exports.LP_SAFE_ADDRESS = "0x5b79121EA6dC2395B8046eCDCE14D66c2bF221B0";

// Protocol contracts
exports.LP_ACCOUNT_ADDRESS = "0xE08Ee4C1b248464aAcC5c0130247b1B9d9e6005E";

// Reward tokens
exports.CRV_ADDRESS = "0xD533a949740bb3306d119CC777fa900bA034cd52";
exports.CVX_ADDRESS = "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B";
exports.SNX_ADDRESS = "0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F";

// 3pool underlying
exports.DAI_ADDRESS = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
exports.USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
exports.USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const threePool = [
  exports.DAI_ADDRESS,
  exports.USDC_ADDRESS,
  exports.USDT_ADDRESS,
];

// Metapool underlying
exports.MUSD_ADDRESS = "0xe2f2a5C287993345a840Db3B0845fbC70f5935a5";

// Stableswaps
exports.THREEPOOL_STABLESWAP_ADDRESS =
  "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";
exports.MUSD_STABLESWAP_ADDRESS = "0x8474DdbE98F5aA3179B3B3F5942D724aFcdec9f6";

exports.DEPEG_THRESHOLDS = {
  [exports.MUSD_ADDRESS]: 0.9,
  [exports.DAI_ADDRESS]: 0.9,
  [exports.USDC_ADDRESS]: 0.9,
  [exports.USDT_ADDRESS]: 0.9,
};

exports.CURVE_POOLS = {
  [exports.THREEPOOL_STABLESWAP_ADDRESS]: threePool,
  [exports.MUSD_STABLESWAP_ADDRESS]: [exports.MUSD_ADDRESS, ...threePool],
};

exports.SWAPS = {
  CRV: {
    name: "crv-to-usdc",
    address: exports.CRV_ADDRESS,
    inTokenDecimals: 18n,
    outTokenDecimals: 6n,
    slippage: "0.05",
  },
  CVX: {
    name: "cvx-to-usdc",
    address: exports.CVX_ADDRESS,
    inTokenDecimals: 18n,
    outTokenDecimals: 6n,
    slippage: "0.05",
  },
};

exports.LP_ACCOUNT_ABI = [
  {
    inputs: [
      {
        internalType: "string[]",
        name: "names",
        type: "string[]",
      },
    ],
    name: "claim",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "name",
        type: "string",
      },
    ],
    name: "getLpTokenBalance",
    outputs: [
      {
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "name",
        type: "string",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "minAmount",
        type: "uint256",
      },
    ],
    name: "swap",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "zapNames",
    outputs: [
      {
        internalType: "string[]",
        name: "",
        type: "string[]",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];
exports.ERC20_ABI = [
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
    ],
    name: "balanceOf",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

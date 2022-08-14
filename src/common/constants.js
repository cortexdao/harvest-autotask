exports.LP_SAFE_ADDRESS = "0x5b79121EA6dC2395B8046eCDCE14D66c2bF221B0";

exports.LP_ACCOUNT_ADDRESS = "0xE08Ee4C1b248464aAcC5c0130247b1B9d9e6005E";
exports.CRV_ADDRESS = "0xD533a949740bb3306d119CC777fa900bA034cd52";
exports.CVX_ADDRESS = "0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B";
exports.SNX_ADDRESS = "0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F";
exports.USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
exports.MUSD_ADDRESS = "0xe2f2a5C287993345a840Db3B0845fbC70f5935a5";

exports.DEPEG_THRESHOLDS = {
  [exports.MUSD_ADDRESS]: 0.9,
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

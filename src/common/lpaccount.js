const { ethers } = require("ethers");
const coingecko = require("./coingecko");
const { LP_ACCOUNT_ADDRESS, SWAPS } = require("./constants");
const erc20Abi = require("../abis/ERC20.json");
const lpAccountAbi = require("../abis/LpAccountV2.json");

exports.getZapNames = async (signer) => {
  const lpAccount = new ethers.Contract(
    LP_ACCOUNT_ADDRESS,
    lpAccountAbi,
    signer
  );
  const zapNames = await lpAccount.zapNames();
  return zapNames;
};

exports.getLpBalances = async (lpAccount, zapNames) => {
  const lpBalances = await Promise.all(
    zapNames.map((zap) => lpAccount.getLpTokenBalance(zap).catch(() => 0))
  );
  const lpBalancesBigInt = lpBalances.map((balance) => BigInt(balance));

  return lpBalancesBigInt;
};

exports.getClaimNames = (zapNames, lpBalances) => {
  if (zapNames.length !== lpBalances.length) {
    throw new Error("Invalid number of claim names or LP balances");
  }

  const claimNames = zapNames.filter((_, i) => lpBalances[i] > 0);
  return claimNames;
};

exports.createClaimTx = async (signer) => {
  const lpAccount = new ethers.Contract(
    LP_ACCOUNT_ADDRESS,
    lpAccountAbi,
    signer
  );

  // Get the zaps to claim from
  const zapNames = await lpAccount.zapNames();
  const lpBalances = await exports.getLpBalances(lpAccount, zapNames);
  const claimNames = exports.getClaimNames(zapNames, lpBalances);

  // Create the `claim` tx object
  const data = lpAccount.interface.encodeFunctionData("claim", [claimNames]);
  const tx = {
    to: lpAccount.address,
    data,
    value: 0,
  };

  return tx;
};

// Return value has inTokenDecimals (generally 18)
exports.getSwapAmountUsdValue = (amount, tokenPrice) => {
  if (tokenPrice < 0) {
    throw new RangeError("Token price cannot be negative");
  }

  const usdValue = coingecko.getUsdValueUnnormalized(amount, tokenPrice);
  return usdValue;
};

exports.getSlippageUsdValue = (usdValue, slippage) => {
  const slippageDecimals = 4n;
  const slippageBigInt = ethers.utils
    .parseUnits(slippage, slippageDecimals)
    .toBigInt();

  if (slippageBigInt < 0) {
    throw new RangeError("Slippage cannot be negative");
  }

  const slippageUsdValue =
    (usdValue * slippageBigInt) / 10n ** slippageDecimals;

  return slippageUsdValue;
};

// Make sure FixedNumber math operations have their operands checked
// - Operations are unsafe and will overflow without throwing an error
// Return value has outTokenDecimals (generally 6)
exports.getSwapMinAmount = async (swap, amount) => {
  const {
    address: tokenAddress,
    slippage,
    outTokenDecimals,
    inTokenDecimals,
  } = SWAPS[swap];

  // Accessed from the exports object so it can be mocked in tests
  const tokenPrice = await coingecko.getTokenPrice(tokenAddress);

  const usdValue = exports.getSwapAmountUsdValue(amount, tokenPrice);

  const slippageUsdValue = exports.getSlippageUsdValue(usdValue, slippage);

  // convert to outTokenDecimals
  const minAmount =
    ((usdValue - slippageUsdValue) * 10n ** outTokenDecimals) /
    10n ** inTokenDecimals;

  if (minAmount < 0) {
    throw new RangeError("Minimum amount cannot be negative");
  }

  return minAmount;
};

exports.createSwapTx = async (signer, swap) => {
  const lpAccount = new ethers.Contract(
    LP_ACCOUNT_ADDRESS,
    lpAccountAbi,
    signer
  );

  const {
    name: swapName,
    address: inTokenAddress,
    outTokenDecimals,
  } = SWAPS[swap];

  const token = new ethers.Contract(inTokenAddress, erc20Abi, signer);

  const amount = (await token.balanceOf(lpAccount.address)).toBigInt();
  if (amount < 1n) {
    throw Error("No reward tokens available for swap");
  }

  const minAmount = await exports.getSwapMinAmount(swap, amount);
  if (minAmount < 100n * 10n ** outTokenDecimals) {
    throw Error(
      `USD value of reward tokens is too low: $${ethers.utils.formatUnits(
        minAmount,
        outTokenDecimals
      )}`
    );
  }

  const data = lpAccount.interface.encodeFunctionData("swap", [
    swapName,
    amount,
    minAmount,
  ]);

  const tx = {
    to: lpAccount.address,
    data,
    value: 0,
  };

  return tx;
};

const { ethers } = require("ethers");
const coingecko = require("./coingecko");
const {
  TVL_MANAGER_ADDRESS,
  LP_ACCOUNT_ADDRESS,
  USD_DECIMALS,
} = require("./constants");

const tvlManagerAbi = require("../abis/TvlManager.json");
const allocationAbi = require("../abis/IAssetAllocation.json");

exports.getAllocations = async (allocationNames, tvlManager, signer) => {
  const getAllocationAddress = (name) => tvlManager.getAssetAllocation(name);
  const allocationAddressResults = await Promise.all(
    allocationNames.map(getAllocationAddress)
  );
  const allocationAddresses = allocationAddressResults.filter(
    (address) => address !== ethers.constants.AddressZero
  );

  const getAllocation = (address) =>
    new ethers.Contract(address, allocationAbi, signer);
  const allocations = allocationAddresses.map(getAllocation);

  return allocations;
};

exports.getAllocationTokenPrices = async (tokens) => {
  const uniqueTokenAddresses = [
    ...new Set(tokens.flat().map(({ token }) => token)),
  ];

  const tokenPriceResults = await coingecko.getTokenPrice(uniqueTokenAddresses);
  const tokenPriceEntries = uniqueTokenAddresses.map((address, i) => [
    address,
    tokenPriceResults[i],
  ]);
  const tokenPrices = Object.fromEntries(tokenPriceEntries);

  return tokenPrices;
};

exports.getTokenValue = async (
  tokenPrices,
  allocation,
  { token, decimals },
  i
) => {
  const balance = (
    await allocation.balanceOf(LP_ACCOUNT_ADDRESS, i)
  ).toBigInt();
  const normalizedBalance =
    (balance * 10n ** USD_DECIMALS) / 10n ** BigInt(decimals);

  const tokenValue = coingecko.getUsdValueUnnormalized(
    normalizedBalance,
    tokenPrices[token]
  );

  return tokenValue;
};

exports.getValue = async (tokens, tokenPrices, allocation, i) => {
  const tokenValues = await Promise.all(
    tokens[i].map((token, i) =>
      exports.getTokenValue(tokenPrices, allocation, token, i)
    )
  );
  const value = tokenValues.reduce((a, b) => a + b);

  const allocationName = await allocation.NAME();

  return { name: allocationName, value, tokens: tokens[i] };
};

exports.getIndexPositions = async (signer, allocationNames) => {
  const tvlManager = new ethers.Contract(
    TVL_MANAGER_ADDRESS,
    tvlManagerAbi,
    signer
  );

  const allocations = await exports.getAllocations(
    allocationNames,
    tvlManager,
    signer
  );

  const getTokens = (allocation) => allocation.tokens();
  const tokens = await Promise.all(allocations.map(getTokens));

  const tokenPrices = await exports.getAllocationTokenPrices(tokens);

  const positions = await Promise.all(
    allocations.map((allocation, i) =>
      exports.getValue(tokens, tokenPrices, allocation, i)
    )
  );

  return positions;
};

const { ethers } = require("ethers");
const coingecko = require("./coingecko");
const {
  TVL_MANAGER_ADDRESS,
  LP_ACCOUNT_ADDRESS,
  USD_DECIMALS,
  TARGET_WEIGHTS,
  WEIGHT_DECIMALS,
} = require("./constants");

const tvlManagerAbi = require("../abis/TvlManager.json");
const allocationAbi = require("../abis/IAssetAllocation.json");

exports.TvlManager = class {
  constructor(signer) {
    this.signer = signer;
    this.contract = new ethers.Contract(
      TVL_MANAGER_ADDRESS,
      tvlManagerAbi,
      signer
    );
  }

  async getAllocations(allocationNames) {
    const getAllocationAddress = (name) =>
      this.contract.getAssetAllocation(name);

    const allocationAddressResults = await Promise.all(
      allocationNames.map(getAllocationAddress)
    );

    const isAddressZero = (address) => address !== ethers.constants.AddressZero;
    const allocationAddresses = allocationAddressResults.filter(isAddressZero);

    const getAllocation = (address) =>
      new ethers.Contract(address, allocationAbi, this.signer);
    const allocations = allocationAddresses.map(getAllocation);

    return allocations;
  }

  async getAllocationTokenPrices(tokens) {
    const uniqueTokenAddresses = [
      ...new Set(tokens.flat().map(({ token }) => token)),
    ];

    const tokenPriceResults = await coingecko.getTokenPrice(
      uniqueTokenAddresses
    );

    const getTokenPriceEntry = (address, i) => [address, tokenPriceResults[i]];
    const tokenPriceEntries = uniqueTokenAddresses.map(getTokenPriceEntry);

    const tokenPrices = Object.fromEntries(tokenPriceEntries);

    return tokenPrices;
  }

  async getTokenValue(tokenPrices, allocation, { token, decimals }, i) {
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
  }

  async getValue(tokens, tokenPrices, allocation, i) {
    const tokenValuePromises = tokens[i].map((token, i) =>
      this.getTokenValue(tokenPrices, allocation, token, i)
    );

    const tokenValues = await Promise.all(tokenValuePromises);

    const value = tokenValues.reduce((a, b) => a + b);
    const allocationName = await allocation.NAME();

    return { name: allocationName, value, tokens: tokens[i] };
  }

  async getIndexPositions(allocationNames) {
    const allocations = await this.getAllocations(allocationNames);

    const getTokens = (allocation) => allocation.tokens();
    const tokens = await Promise.all(allocations.map(getTokens));

    const tokenPrices = await this.getAllocationTokenPrices(tokens);

    const positionPromises = allocations.map((allocation, i) =>
      this.getValue(tokens, tokenPrices, allocation, i)
    );
    const positions = await Promise.all(positionPromises);

    return positions;
  }

  getNav(positions) {
    const nav = positions.reduce((nav, { value }) => (nav += value), 0n);
    return nav;
  }

  getTargetValues(positions) {
    const nav = this.getNav(positions);

    const targetValueEntries = TARGET_WEIGHTS.map(({ name, weight }) => {
      const value = (weight * nav) / 10n ** WEIGHT_DECIMALS;
      return [name, value];
    });

    const targetValues = Object.fromEntries(targetValueEntries);
    return targetValues;
  }

  getPositionDeltas(positions) {
    const targetValues = this.getTargetValues(positions);

    const positionDeltas = positions.map(({ name, value }) => {
      const target = targetValues[name] || 0n;
      return { name, delta: target - value };
    });

    return positionDeltas;
  }

  getLargestPositionDelta(positions) {
    const positionDeltas = this.getPositionDeltas(positions);

    const getLargerDelta = (largest, position) =>
      position.delta > largest.delta ? position : largest;

    const largestPositionDelta = positionDeltas.reduce(getLargerDelta);

    return largestPositionDelta;
  }
};

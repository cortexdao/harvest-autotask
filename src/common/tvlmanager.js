const { ethers } = require("ethers");
const coingecko = require("./coingecko");
const {
  TVL_MANAGER_ADDRESS,
  LP_ACCOUNT_ADDRESS,
  USD_DECIMALS,
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

    const allocationAddressPromises = allocationNames.map(getAllocationAddress);
    const allocationAddressResults = await Promise.all(
      allocationAddressPromises
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
    const getTokenValue = (token, i) =>
      this.getTokenValue(tokenPrices, allocation, token, i);

    const tokenValuePromises = tokens[i].map(getTokenValue);
    const tokenValues = await Promise.all(tokenValuePromises);

    const value = tokenValues.reduce((a, b) => a + b);
    const allocationName = await allocation.NAME();

    return { name: allocationName, value, tokens: tokens[i] };
  }

  async getIndexPositions(allocationNames) {
    const allocations = await this.getAllocations(allocationNames);

    const getTokens = (allocation) => allocation.tokens();
    const tokenPromises = allocations.map(getTokens);
    const tokens = await Promise.all(tokenPromises);

    const tokenPrices = await this.getAllocationTokenPrices(tokens);

    const getPosition = (allocation, i) =>
      this.getValue(tokens, tokenPrices, allocation, i);

    const positionPromises = allocations.map(getPosition);
    const positions = await Promise.all(positionPromises);

    return positions;
  }

  getNav(positions) {
    const sumNav = (nav, { value }) => (nav += value);
    const nav = positions.reduce(sumNav, 0n);
    return nav;
  }
};

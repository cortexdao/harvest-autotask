const _ = require("lodash");
const { ethers } = require("ethers");
const { createTx } = require("./utils");
const {
  META_POOL_TOKEN_ADDRESS,
  RESERVE_POOLS,
  RESERVE_POOL_IDS,
} = require("./constants");

const maptAbi = require("../abis/MetaPoolTokenV2.json");

exports.MetaPoolToken = class {
  constructor(signer) {
    this.contract = new ethers.Contract(
      META_POOL_TOKEN_ADDRESS,
      maptAbi,
      signer
    );
  }

  /**
   * Output format:
   *
   *  [
   *    {
   *      address: "0x0", // Reserve pool address
   *      amount: -10n // Reserve pool rebalance amount
   *    },
   *    { address: "0x1", amount: 10n },
   *    { address: "0x2", amount: -20n },
   *  ]
   *
   * (-) amount means extra reserves that can fund the LP Account
   * (+) amount means reserves must be withdrawn from the LP Account
   */
  async getRebalanceAmounts() {
    const result = await this.contract.getRebalanceAmounts(RESERVE_POOL_IDS);

    const createAmountObj = (address, i) => {
      return { address, amount: result[1][i].toBigInt() };
    };

    const rebalanceAmounts = result[0].map(createAmountObj);

    return rebalanceAmounts;
  }

  createFundLpAccountTx(reserveIds) {
    const tx = createTx(this.contract, "fundLpAccount", [reserveIds]);
    return tx;
  }
};

exports.getRebalanceAmounts = async (signer) => {
  const mapt = new ethers.Contract(META_POOL_TOKEN_ADDRESS, maptAbi, signer);
  const result = await mapt.getRebalanceAmounts(RESERVE_POOL_IDS);

  const getRebalanceAmount = (address, i) => {
    return { address, amount: result[1][i].toBigInt() };
  };
  const rebalanceAmounts = result[0].map(getRebalanceAmount);

  return rebalanceAmounts;
};

exports.normalizeRebalanceAmounts = (rebalanceAmounts) => {
  const decimals = _.map(Object.values(RESERVE_POOLS), "underlyerDecimals");
  const normalizedDecimals = _.max(decimals);

  const normalizeAmount = ({ address, amount }) => {
    const { underlyerDecimals } = RESERVE_POOLS[address];
    const normalizedAmount =
      (amount * 10n ** normalizedDecimals) / 10n ** underlyerDecimals;
    return { address, amount: normalizedAmount };
  };
  const normalizedAmounts = rebalanceAmounts.map(normalizeAmount);

  return normalizedAmounts;
};

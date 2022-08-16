const { ethers } = require("ethers");
const { META_POOL_TOKEN_ADDRESS, RESERVE_POOL_IDS } = require("./constants");
const maptAbi = require("../abis/MetaPoolTokenV2.json");

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
exports.getRebalanceAmounts = async (signer) => {
  const mapt = new ethers.Contract(META_POOL_TOKEN_ADDRESS, maptAbi, signer);
  const result = await mapt.getRebalanceAmounts(RESERVE_POOL_IDS);

  const rebalanceAmounts = result[0].map((address, i) => {
    return { address, amount: result[1][i].toBigInt() };
  });

  return rebalanceAmounts;
};

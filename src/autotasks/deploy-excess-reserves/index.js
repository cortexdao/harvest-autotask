const { ethers } = require("ethers");
const {
  DefenderRelaySigner,
  DefenderRelayProvider,
} = require("defender-relay-client/lib/ethers");

const { executeSafeTx, getSafe } = require("../../common/safe");

const { MetaPoolToken } = require("../../common/mapt");

const { RESERVE_POOLS } = require("../../common/constants");

exports.getExcessReserveIds = (rebalanceAmounts) => {
  // Reserve is in excess when rebalance amount is negative
  const isAmountExcess = ({ amount }) => amount < 0;
  const excessReserves = rebalanceAmounts.filter(isAmountExcess);
  const excessReserveIds = excessReserves.map(
    ({ address }) => RESERVE_POOLS[address].id
  );

  return excessReserveIds;
};

exports.main = async (signer) => {
  const safe = await getSafe(signer);

  const mapt = new MetaPoolToken(signer);

  const rebalanceAmounts = await mapt.getRebalanceAmounts();

  const excessReserveIds = exports.getExcessReserveIds(rebalanceAmounts);

  const tx = mapt.createFundLpAccountTx(excessReserveIds);

  const receipt = await executeSafeTx(tx, safe);

  return receipt;
};

// Entrypoint for the Autotask
exports.handler = async (credentials) => {
  const provider = new DefenderRelayProvider(credentials);
  const signer = new DefenderRelaySigner(credentials, provider, {
    speed: "fast",
  });
  const receipt = exports.main(signer);

  return receipt;
};

// To run locally (this code will not be executed in Autotasks)
if (require.main === module) {
  require("dotenv").config();
  const { RELAY_API_KEY: apiKey, RELAY_API_SECRET: apiSecret } = process.env;
  exports
    .handler({ apiKey, apiSecret })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

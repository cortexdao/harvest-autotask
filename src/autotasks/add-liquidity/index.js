const { ethers } = require("ethers");
const {
  DefenderRelaySigner,
  DefenderRelayProvider,
} = require("defender-relay-client/lib/ethers");

const { RESERVE_POOLS } = require("../../common/constants");

const { MetaPoolToken } = require("../../common/mapt");
const { LpAccount } = require("../../common/lpaccount");
const { TvlManager } = require("../../common/tvlmanager");

exports.main = async (signer) => {
  const mapt = new MetaPoolToken(signer);
  const rebalanceAmounts = await mapt.getRebalanceAmounts();

  const lpAccount = new LpAccount(signer);
  const tokenAmountToAddLiquidity = await lpAccount.getTokenAmountToAddLiquity(
    rebalanceAmounts
  );

  if (tokenAmountToAddLiquidity === undefined) {
    return {};
  }

  const tvlManager = new TvlManager(signer);

  const names = await lpAccount.getZapNames();
  const positions = await tvlManager.getIndexPositions(names);
  const largestPositionDelta = tvlManager.getLargestPositionDelta(positions);
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

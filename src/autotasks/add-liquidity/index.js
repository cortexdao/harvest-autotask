const { ethers } = require("ethers");
const {
  DefenderRelaySigner,
  DefenderRelayProvider,
} = require("defender-relay-client/lib/ethers");

const { executeSafeTx, getSafe } = require("../../common/safe");

const { Strategy } = require("../../common/strategy");

exports.main = async (signer) => {
  const strategy = new Strategy(signer);
  const nextAddLiquidityTx = await strategy.getNextAddLiquidityTx();

  const safe = await getSafe(signer);
  const receipt = await executeSafeTx(nextAddLiquidityTx, safe);

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

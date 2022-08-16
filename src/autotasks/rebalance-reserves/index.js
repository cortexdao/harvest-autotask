const { ethers } = require("ethers");
const {
  DefenderRelaySigner,
  DefenderRelayProvider,
} = require("defender-relay-client/lib/ethers");

const { TARGET_WEIGHTS, WEIGHT_DECIMALS } = require("../../common/constants");

exports.getPositionDeltas = (positionSizes) => {
  const nav = positionSizes.reduce((nav, { value }) => (nav += value), 0n);

  const targetValueEntries = TARGET_WEIGHTS.map(({ name, weight }) => {
    const value = (weight * nav) / 10n ** WEIGHT_DECIMALS;
    return [name, value];
  });
  const targetValues = Object.fromEntries(targetValueEntries);

  const sizeDeltas = positionSizes.map(({ name, value }) => {
    const target = targetValues[name] || 0n;
    return { name, delta: target - value };
  });

  return sizeDeltas;
};

exports.main = async (signer) => {
};

// Entrypoint for the Autotask
exports.handler = async (credentials) => {
  const provider = new DefenderRelayProvider(credentials);
  const signer = new DefenderRelaySigner(credentials, provider, {
    speed: "fast",
  });
  const receipts = exports.main(signer);

  return receipts;
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

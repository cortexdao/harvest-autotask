const { ethers } = require("ethers");
const {
  DefenderRelaySigner,
  DefenderRelayProvider,
} = require("defender-relay-client/lib/ethers");

const { RESERVE_POOLS } = require("../../common/constants");

const { MetaPoolToken } = require("../../common/mapt");
const { LpAccount } = require("../../common/lpaccount");

exports.getUnderlyersWithNetExcess = (rebalanceAmounts, balances) => {
  // Negative rebalance amount indicates excess reserves
  const getNetAmount = ({ address, amount }) => {
    const underlyer = RESERVE_POOLS[address].underlyer;
    const netAmount = balances[underlyer] - amount;
    return { address: underlyer, amount: netAmount };
  };

  const netAmounts = rebalanceAmounts.map(getNetAmount);
  const filteredAmounts = netAmounts.filter(({ amount }) => amount > 0n);

  return filteredAmounts;
};

exports.main = async (signer) => {
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

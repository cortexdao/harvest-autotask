const { ethers } = require("ethers");
const {
  DefenderRelaySigner,
  DefenderRelayProvider
} = require('defender-relay-client/lib/ethers');

const { LP_ACCOUNT_ADDRESS, LP_ACCOUNT_ABI } = require("./constants");

exports.main = async function(signer) {
}

// Entrypoint for the Autotask
exports.handler = async function(event) {
  const provider = new DefenderRelayProvider(credentials);
  const signer = new DefenderRelaySigner(credentials, provider, { speed: 'fast' });
  return main(signer);
}

// To run locally (this code will not be executed in Autotasks)
if (require.main === module) {
  require('dotenv').config()
  const { API_KEY: apiKey, API_SECRET: apiSecret } = process.env;
  exports.handler({ apiKey, apiSecret })
    .then(() => process.exit(0))
    .catch(error => { console.error(error); process.exit(1); });
}

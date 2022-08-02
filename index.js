const { ethers } = require("ethers");
const {
  DefenderRelaySigner,
  DefenderRelayProvider
} = require('defender-relay-client/lib/ethers');

const { LP_ACCOUNT_ADDRESS, LP_ACCOUNT_ABI } = require("./constants");

exports.main = async (signer) => {
  const lpAccount = new ethers.Contract(LP_ACCOUNT_ADDRESS, LP_ACCOUNT_ABI, signer);
  const zapNames = await lpAccount.zapNames();
  const lpBalances = await Promise.all(zapNames.map(zap => lpAccount.getLpTokenBalance(zap)));
  const claims = zapNames.filter((_, i) => lpBalances[i].gt(0));
}

// Entrypoint for the Autotask
exports.handler = async (event) => {
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

const { ethers } = require("ethers");
const {
  DefenderRelaySigner,
  DefenderRelayProvider,
} = require("defender-relay-client/lib/ethers");
const { default: Safe, EthersAdapter } = require("@gnosis.pm/safe-core-sdk");
const {
  LP_SAFE_ADDRESS,
  LP_ACCOUNT_ADDRESS,
  LP_ACCOUNT_ABI,
} = require("./constants");

exports.getLpBalances = async (lpAccount, zapNames) => {
  const lpBalances = await Promise.all(
    zapNames.map((zap) =>
      lpAccount.getLpTokenBalance(zap).catch(() => ethers.BigNumber.from(0))
    )
  );
  return lpBalances;
};

exports.getClaimNames = (zapNames, lpBalances) => {
  if (zapNames.length !== lpBalances.length) {
    throw new Error("Invalid number of claim names or LP balances");
  }

  const claimNames = zapNames.filter((_, i) => lpBalances[i].gt(0));
  return claimNames;
};

exports.getSafe = async (signer) => {
  const ethAdapter = new EthersAdapter({ ethers, signer });
  const safe = await Safe.create({ ethAdapter, safeAddress: LP_SAFE_ADDRESS });

  return safe;
};

exports.createClaimTx = async (signer) => {
  const lpAccount = new ethers.Contract(
    LP_ACCOUNT_ADDRESS,
    LP_ACCOUNT_ABI,
    signer
  );

  // Get the zaps to claim from
  const zapNames = await lpAccount.zapNames();
  const lpBalances = await exports.getLpBalances(lpAccount, zapNames);
  const claimNames = exports.getClaimNames(zapNames, lpBalances);

  // Create the `claim` tx object
  const data = lpAccount.interface.encodeFunctionData("claim", [claimNames]);
  const tx = {
    to: lpAccount.address,
    data,
    value: 0,
  };

  return tx;
};

exports.main = async (signer) => {
  let tx = await exports.createClaimTx(signer);

  // Create Safe tx
  const safe = await exports.getSafe(signer);

  const safeTx = await safe.createTransaction(tx);

  const baseGas = 100000;
  const options = {
    // Required to short-circuit call to `estimateGasForTransactionExecution`
    // - Tries to estimate gas using the `gasPrice` set in the safe tx
    // ^- The `gasPrice` in the safe tx is also used for reimbursement
    // ^- This creates a conflict where `gasPrice` must be both zero and non-zero
    gasLimit: safeTx.data["safeTxGas"] + baseGas,
  };

  const executedTx = await safe.executeTransaction(safeTx, options);
  const receipt = await executedTx.transactionResponse?.wait();

  return receipt;
};

// Entrypoint for the Autotask
exports.handler = async (event) => {
  const provider = new DefenderRelayProvider(credentials);
  const signer = new DefenderRelaySigner(credentials, provider, {
    speed: "fast",
  });
  return main(signer);
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

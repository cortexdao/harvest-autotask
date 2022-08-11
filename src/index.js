const { ethers } = require("ethers");
const {
  DefenderRelaySigner,
  DefenderRelayProvider,
} = require("defender-relay-client/lib/ethers");
const { default: Safe, EthersAdapter } = require("@gnosis.pm/safe-core-sdk");
const { LP_SAFE_ADDRESS } = require("./constants");

const lpaccount = require("./lpaccount");
const { createClaimTx } = lpaccount;

exports.getSafe = async (signer) => {
  const ethAdapter = new EthersAdapter({ ethers, signer });
  const safe = await Safe.create({ ethAdapter, safeAddress: LP_SAFE_ADDRESS });

  return safe;
};

exports.executeSafeTx = async (tx, safe) => {
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

  // Cannot use `?.` operator here because the autotask env uses node 12
  // - Optional chaining with `.?` requires node 14
  let receipt;
  if (executedTx.transactionResponse) {
    receipt = await executedTx.transactionResponse.wait();
  } else {
    receipt = undefined;
  }

  return receipt;
};

exports.claimWithSafe = async (safe, signer) => {
  const tx = await createClaimTx(signer);
  const receipt = await exports.executeSafeTx(tx, safe);

  return receipt;
};

exports.swapWithSafe = async (safe, signer) => {
  const swaps = ["CRV", "CVX"];
  const txs = await Promise.allSettled(
    // Accessed from the exports object so it can be mocked in tests
    swaps.map((swap) => lpaccount.createSwapTx(signer, swap))
  );
  const filteredTxs = txs.filter((tx) => tx.status === "fulfilled");

  const receipts = await Promise.all(
    filteredTxs.map(({ value: tx }) => exports.executeSafeTx(tx, safe))
  );

  return receipts;
};

exports.main = async (signer) => {
  const safe = await exports.getSafe(signer);

  const claimReceipt = await exports.claimWithSafe(safe, signer);
  const swapReceipts = await exports.swapWithSafe(safe, signer);

  return { claimReceipt, swapReceipts };
};

// Entrypoint for the Autotask
exports.handler = async (event) => {
  const provider = new DefenderRelayProvider(credentials);
  const signer = new DefenderRelaySigner(credentials, provider, {
    speed: "fast",
  });
  const receipts = main(signer);

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

const { ethers } = require("ethers");
const { default: Safe } = require("@gnosis.pm/safe-core-sdk");
const { default: EthersAdapter } = require("@gnosis.pm/safe-ethers-lib");
const { LP_SAFE_ADDRESS } = require("./constants");

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

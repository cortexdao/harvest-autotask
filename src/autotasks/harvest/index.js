const { ethers } = require("ethers");
const {
  DefenderRelaySigner,
  DefenderRelayProvider,
} = require("defender-relay-client/lib/ethers");

const safeHelpers = require("../../common/safe");
const { getSafe } = safeHelpers;

const lpaccount = require("../../common/lpaccount");
const { createClaimTx } = lpaccount;

exports.claimWithSafe = async (safe, signer) => {
  const tx = await createClaimTx(signer);
  // Accessed from the exports object so it can be mocked in tests
  const receipt = await safeHelpers.executeSafeTx(tx, safe);

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
    // Accessed from the exports object so it can be mocked in tests
    filteredTxs.map(({ value: tx }) => safeHelpers.executeSafeTx(tx, safe))
  );

  return receipts;
};

exports.main = async (signer) => {
  const safe = await getSafe(signer);

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

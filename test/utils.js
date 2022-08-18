const { ethers } = require("hardhat");
const {
  impersonateAccount,
  stopImpersonatingAccount,
  setBalance,
} = require("@nomicfoundation/hardhat-network-helpers");

const { LP_SAFE_ADDRESS } = require("../src/common/constants");

const safeAbi = require("../src/abis/GnosisSafe.json");

// Used to add an owner in tests
exports.addOwnerWithThreshold = async (owner) => {
  await impersonateAccount(LP_SAFE_ADDRESS);
  await setBalance(LP_SAFE_ADDRESS, 10n ** 18n);
  const signer = await ethers.getSigner(LP_SAFE_ADDRESS);

  const safe = new ethers.Contract(LP_SAFE_ADDRESS, safeAbi, signer);
  const threshold = await safe.getThreshold();
  const tx = await safe.addOwnerWithThreshold(owner, threshold);

  await stopImpersonatingAccount(LP_SAFE_ADDRESS);

  return tx;
};

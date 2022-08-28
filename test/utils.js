const { ethers } = require("hardhat");
const {
  impersonateAccount,
  stopImpersonatingAccount,
  setBalance,
} = require("@nomicfoundation/hardhat-network-helpers");

const {
  LP_SAFE_ADDRESS,
  ADMIN_SAFE_ADDRESS,
  RESERVE_POOLS,
} = require("../src/common/constants");

const safeAbi = require("../src/abis/GnosisSafe.json");
const poolTokenAbi = require("../src/abis/PoolTokenV3.json");

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

exports.forceTransfer = async (token, from, to, amount) => {
  await impersonateAccount(from);
  await setBalance(from, 10n ** 18n);
  const fromSigner = await ethers.getSigner(from);

  const tx = await token.connect(fromSigner).transfer(to, amount);

  await stopImpersonatingAccount(from);

  return tx;
};

exports.setReservePercentage = async (percentage) => {
  await impersonateAccount(ADMIN_SAFE_ADDRESS);
  await setBalance(ADMIN_SAFE_ADDRESS, 10n ** 18n);
  const adminSafeSigner = await ethers.getSigner(ADMIN_SAFE_ADDRESS);

  const reserveAddresses = Object.keys(RESERVE_POOLS);
  const getReserve = (address) =>
    new ethers.Contract(address, poolTokenAbi, adminSafeSigner);
  const reserves = reserveAddresses.map(getReserve);

  const setReservePct = (reserve) => reserve.setReservePercentage(percentage);
  const setReservePctPromises = reserves.map(setReservePct);

  await Promise.all(setReservePctPromises);

  await stopImpersonatingAccount(ADMIN_SAFE_ADDRESS);
};

const { ethers } = require("ethers");

exports.toBigInt = (value, decimals) => {
  const valueBigInt = ethers.utils
    .parseUnits(value.toString(), decimals)
    .toBigInt();
  return valueBigInt;
};

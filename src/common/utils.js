const { ethers } = require("ethers");

exports.toBigInt = (value, decimals) => {
  const valueBigInt = ethers.utils
    .parseUnits(value.toString(), decimals)
    .toBigInt();
  return valueBigInt;
};

exports.createTx = (contract, fragment, values = []) => {
  const data = contract.interface.encodeFunctionData(fragment, values);

  const tx = {
    to: contract.address,
    data,
    value: 0,
  };

  return tx;
};

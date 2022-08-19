const { ethers } = require("ethers");

const erc20Abi = require("../abis/ERC20.json");

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

exports.convertTokenAmountDecimals = async (
  { address, amount },
  decimals,
  signer
) => {
  const token = new ethers.Contract(address, erc20Abi, signer);
  const underlyerDecimals = BigInt(await token.decimals());
  const normalizedAmount =
    (amount * 10n ** decimals) / 10n ** underlyerDecimals;
  return { address, amount: normalizedAmount };
};

exports.normalizeTokenAmounts = async (tokenAmounts, decimals, signer) => {
  const getNormalizedAmount = (tokenAmount) =>
    exports.convertTokenAmountDecimals(tokenAmount, decimals, signer);
  const normalizedAmountPromises = tokenAmounts.map(getNormalizedAmount);
  const normalizedAmounts = await Promise.all(normalizedAmountPromises);
  return normalizedAmounts;
};

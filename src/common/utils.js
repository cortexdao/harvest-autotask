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

exports.normalizeTokenAmounts = async (tokenAmounts, decimals, signer) => {
  const getNormalizedAmount = async ({ address, amount }) => {
    const token = new ethers.Contract(address, erc20Abi, signer);
    const underlyerDecimals = BigInt(await token.decimals());
    const normalizedAmount =
      (amount * 10n ** decimals) / 10n ** underlyerDecimals;
    return { address, amount: normalizedAmount };
  };

  const normalizedAmounts = await Promise.all(
    tokenAmounts.map(getNormalizedAmount)
  );

  return normalizedAmounts;
};

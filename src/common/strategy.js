const { ethers } = require("ethers");

const { MetaPoolToken } = require("./mapt");
const { LpAccount } = require("./lpaccount");
const { TvlManager } = require("./tvlmanager");

const {
  convertTokenAmountDecimals,
  normalizeTokenAmounts,
} = require("./utils");

const {
  RESERVE_POOLS,
  POSITION_ADD_PCT,
  POSITION_ADD_PCT_DECIMALS,
  MAX_ADD_LIQUIDITY,
  USD_DECIMALS,
  TARGET_WEIGHTS,
  WEIGHT_DECIMALS,
} = require("./constants");

exports.Strategy = class {
  constructor(signer) {
    this.signer = signer;
    this.mapt = new MetaPoolToken(signer);
    this.lpAccount = new LpAccount(signer);
    this.tvlManager = new TvlManager(signer);
  }

  getTargetValues(positions) {
    const nav = this.tvlManager.getNav(positions);

    const getTargetValue = ({ name, weight }) => {
      const value = (weight * nav) / 10n ** WEIGHT_DECIMALS;
      return [name, value];
    };

    const targetValueEntries = TARGET_WEIGHTS.map(getTargetValue);
    const targetValues = Object.fromEntries(targetValueEntries);

    return targetValues;
  }

  getPositionDeltas(positions) {
    const targetValues = this.getTargetValues(positions);

    const getDelta = ({ name, value }) => {
      const target = targetValues[name] || 0n;
      return { name, delta: target - value };
    };

    const positionDeltas = positions.map(getDelta);
    return positionDeltas;
  }

  getLargestPositionDelta(positions) {
    const positionDeltas = this.getPositionDeltas(positions);

    const getLargerDelta = (largest, position) =>
      position.delta > largest.delta ? position : largest;

    const largestPositionDelta = positionDeltas.reduce(getLargerDelta);
    return largestPositionDelta;
  }

  async getNextPosition() {
    const positionNames = await this.lpAccount.getZapNames();
    const positions = await this.tvlManager.getIndexPositions(positionNames);
    const largestPositionDelta = this.getLargestPositionDelta(positions);

    const isPosition = ({ name }) => name === largestPositionDelta.name;
    const positionValue = positions.find(isPosition).value;
    const position = { name: largestPositionDelta.name, value: positionValue };

    return position;
  }

  getUnderlyersWithNetExcess(rebalanceAmounts, balances) {
    // Negative rebalance amount indicates excess reserves
    const getNetAmount = ({ address, amount }) => {
      const underlyer = RESERVE_POOLS[address].underlyer;
      const netAmount = balances[underlyer] - amount;
      return { address: underlyer, amount: netAmount };
    };

    const netAmounts = rebalanceAmounts.map(getNetAmount);

    const getExcessAmount = ({ amount }) => amount > 0n;
    const filteredAmounts = netAmounts.filter(getExcessAmount);

    return filteredAmounts;
  }

  getLargestAmount(normalizedAmounts) {
    if (normalizedAmounts.length === 0) {
      throw new RangeError("Unable to get largest amount from empty array");
    }

    const getLargerAmount = (largest, amount) =>
      amount.amount > largest.amount ? amount : largest;
    const largestAmount = normalizedAmounts.reduce(getLargerAmount);

    return largestAmount;
  }

  async getLargestNetExcess(rebalanceAmounts, balances) {
    const netExcessAmounts = this.getUnderlyersWithNetExcess(
      rebalanceAmounts,
      balances
    );

    const normalizedDecimals = 18n;
    const normalizedExcessAmounts = await normalizeTokenAmounts(
      netExcessAmounts,
      normalizedDecimals,
      this.signer
    );

    const largestNetExcess = this.getLargestAmount(normalizedExcessAmounts);

    return largestNetExcess;
  }

  async getNextBalanceAmount() {
    const rebalanceAmounts = await this.mapt.getRebalanceAmounts();
    const balances = await this.lpAccount.getUnderlyerBalances();

    let tokenAmount;

    try {
      tokenAmount = await this.getLargestNetExcess(rebalanceAmounts, balances);
    } catch (error) {
      throw new Error(
        `Unable to get the next balance amount: ${error.message}`
      );
    }

    const nextBalanceAmount = {
      address: tokenAmount.address,
      amount: balances[tokenAmount.address],
    };

    return nextBalanceAmount;
  }

  async getPossibleNextAddLiquidityValues(nextBalanceAmount, nextPosition) {
    const maxNextPositionValue =
      (nextPosition.value * POSITION_ADD_PCT) /
      10n ** POSITION_ADD_PCT_DECIMALS;

    // Assume underlyer equals 1 USD
    const maxNextBalanceValue = await convertTokenAmountDecimals(
      nextBalanceAmount,
      USD_DECIMALS,
      this.signer
    );

    const possibleNextValues = [
      maxNextPositionValue,
      maxNextBalanceValue,
      MAX_ADD_LIQUIDITY,
    ];

    return possibleNextValues;
  }

  async getNextAddLiquidityValue(nextBalanceAmount, nextPosition) {
    const possibleNextValues = await this.getPossibleNextAddLiquidityValues(
      nextBalanceAmount,
      nextPosition
    );

    const getMinValue = (min, value) => (min < value ? min : value);
    const addLiquidityValue = possibleNextValues.reduce(getMinValue);

    return addLiquidityValue;
  }

  async getNextAddLiquidityTx() {
    let nextBalanceAmount;

    try {
      nextBalanceAmount = await this.getNextBalanceAmount();
    } catch (error) {
      throw new Error(`Unable to create tx to add liquidity: ${error.message}`);
    }

    const nextPosition = await this.getNextPosition();

    const addLiquidityValue = await this.getNextAddLiquidityValue(
      nextBalanceAmount,
      nextPosition
    );

    // Assume underlyer equals 1 USD
    const nextAddLiquidity = {
      address: nextBalanceAmount.address,
      amount: addLiquidityValue,
    };

    const params = this.lpAccount.getDeployParams(
      nextPosition.name,
      nextAddLiquidity
    );

    const tx = this.lpAccount.createDeployStrategyTx(...params);

    return tx;
  }
};

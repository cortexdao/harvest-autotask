const _ = require("lodash");
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

  getTargetValues(positions, targetWeights) {
    const nav = BigInt(_.sumBy(positions, "value"));

    const getTargetValue = ({ name, weight }) => {
      const value = (weight * nav) / 10n ** WEIGHT_DECIMALS;
      return [name, value];
    };

    const targetValueEntries = targetWeights.map(getTargetValue);
    const targetValues = Object.fromEntries(targetValueEntries);

    return targetValues;
  }

  getPositionDeltas(positions, targetValues) {
    const getDelta = (name) => {
      const current = _.find(positions, ["name", name]);
      const value = current ? current.value : 0n;
      const target = targetValues[name] || 0n;
      return { name, delta: target - value };
    };

    const positionNames = _.map(positions, "name");
    const targetNames = Object.keys(targetValues);
    const uniqueNames = _.union(positionNames, targetNames);

    const positionDeltas = uniqueNames.map(getDelta);

    return positionDeltas;
  }

  async getNextPosition() {
    const positionNames = await this.lpAccount.getZapNames();
    const positions = await this.tvlManager.getIndexPositions(positionNames);

    const targetValues = this.getTargetValues(positions, TARGET_WEIGHTS);

    const positionDeltas = this.getPositionDeltas(positions, targetValues);

    const largestDelta = _.maxBy(positionDeltas, "delta");

    let position;
    try {
      position = _.find(positions, ["name", largestDelta.name]);
    } catch (error) {
      const errorMessage = "Unable to get next position to add liquidity";
      throw new Error(`${errorMessage}: ${error.message}`);
    }

    position = position || { name: largestDelta.name, value: 0n };

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

  async getLargestTokenAmount(tokenAmount) {
    const normalizedDecimals = 18n;
    const normalizedAmounts = await normalizeTokenAmounts(
      tokenAmount,
      normalizedDecimals,
      this.signer
    );

    // TODO: possible for this to return undefined
    const largestAmount = _.maxBy(normalizedAmounts, "amount");

    return largestAmount;
  }

  async getNextBalanceAmount() {
    const rebalanceAmounts = await this.mapt.getRebalanceAmounts();
    const balances = await this.lpAccount.getUnderlyerBalances();

    const netExcessAmounts = this.getUnderlyersWithNetExcess(
      rebalanceAmounts,
      balances
    );

    let tokenAmount;
    try {
      tokenAmount = await this.getLargestTokenAmount(netExcessAmounts);
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
    const { amount: maxNextBalanceValue } = await convertTokenAmountDecimals(
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

  async getNextAddLiquidityTx() {
    const errorMessage = "Unable to create tx to add liquidity";

    let nextBalanceAmount;
    try {
      nextBalanceAmount = await this.getNextBalanceAmount();
    } catch (error) {
      throw new Error(`${errorMessage}: ${error.message}`);
    }

    let nextPosition;
    try {
      nextPosition = await this.getNextPosition();
    } catch (error) {
      throw new Error(`${errorMessage}: ${error.message}`);
    }

    const possibleNextValues = await this.getPossibleNextAddLiquidityValues(
      nextBalanceAmount,
      nextPosition
    );

    const addLiquidityValue = _.min(possibleNextValues);

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

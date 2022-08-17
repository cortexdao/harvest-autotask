const { ethers } = require("ethers");
const {
  DefenderRelaySigner,
  DefenderRelayProvider,
} = require("defender-relay-client/lib/ethers");


const {
  TARGET_WEIGHTS,
  WEIGHT_DECIMALS,
  RESERVE_POOLS,
} = require("../../common/constants");

exports.getNav = (positions) => {
  const nav = positions.reduce((nav, { value }) => (nav += value), 0n);
  return nav;
};

exports.getTargetValues = (positions) => {
  const nav = exports.getNav(positions);

  const targetValueEntries = TARGET_WEIGHTS.map(({ name, weight }) => {
    const value = (weight * nav) / 10n ** WEIGHT_DECIMALS;
    return [name, value];
  });

  const targetValues = Object.fromEntries(targetValueEntries);
  return targetValues;
};

exports.getPositionDeltas = (positions) => {
  const targetValues = exports.getTargetValues(positions);

  const positionDeltas = positions.map(({ name, value }) => {
    const target = targetValues[name] || 0n;
    return { name, delta: target - value };
  });

  return positionDeltas;
};

// Assumes amounts are normalized
exports.sortRebalanceAmounts = (rebalanceAmounts) => {
  // Negative amount means an excess of reserves
  const sortAmounts = ({ amount: amountA }, { amount: amountB }) =>
    amountA < amountB ? -1 : amountA > amountB ? 1 : 0;

  // Variable for clarity, normalizedAmounts is sorted in place
  const sortedAmounts = rebalanceAmounts.sort(sortAmounts);
  return sortedAmounts;
};

exports.filterPositions = (underlyer, tokens) =>
  tokens.map(({ token }) => token).includes(underlyer);

exports.getRebalancePositions = (reserveAddress, positions) => {
  const { underlyer } = RESERVE_POOLS[reserveAddress];
  const filteredPositions = positions.filter(({ tokens }) =>
    exports.filterPositions(underlyer, tokens)
  );
  return { address: reserveAddress, positions: filteredPositions };
};

exports.getAllRebalancePositions = (rebalanceAmounts, positions) => {
  const rebalancePositions = rebalanceAmounts
    .map(({ address }) => exports.getRebalancePositions(address, positions))
    .filter(({ positions }) => positions.length > 0);

  return rebalancePositions;
};

// Assumes amounts are normalized
exports.getLargestRebalancePositions = (rebalanceAmounts, positions) => {
  const sortedAmounts = exports.sortRebalanceAmounts(rebalanceAmounts);

  const rebalancePositions = exports.getAllRebalancePositions(
    sortedAmounts,
    positions
  );

  const largestRebalancePositions = rebalancePositions.shift();

  return largestRebalancePositions;
};

exports.getLargestPositionDelta = (positions) => {
  const positionDeltas = exports.getPositionDeltas(positions);

  const getLargerDelta = (largest, position) =>
    position.delta > largest.delta ? position : largest;

  const largestPositionDelta = positionDeltas.reduce(getLargerDelta);

  return largestPositionDelta;
};

exports.deployReserves = async (signer, normalizedAmounts, positions) => {
  const largestRebalancePositions = exports.getLargestRebalancePositions(
    normalizedAmounts,
    positions
  );

  if (largestRebalancePositions !== undefined) {
    const largestPositionDelta = exports.getLargestPositionDelta(
      largestRebalancePositions.positions
    );

    console.log(positions);
    console.log(largestPositionDelta);

    const maxDeploy = 20000n * 10n ** 8n;
  }
};

exports.main = async (signer) => {
};

// Entrypoint for the Autotask
exports.handler = async (credentials) => {
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

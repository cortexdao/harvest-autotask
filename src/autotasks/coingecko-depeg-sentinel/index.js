const { ethers } = require("ethers");
const coingecko = require("../../common/coingecko");
const { CURVE_POOLS, DEPEG_THRESHOLDS } = require("../../common/constants");

exports.getGroupedEvents = (events) => {
  const groupEvent = (address, groups, event) => {
    const addressChecksum = ethers.utils.getAddress(address);
    groups[addressChecksum] = groups[addressChecksum] || [];
    groups[addressChecksum].push(event);
  };

  const groupEvents = (groups, event) => {
    event.matchedAddresses.forEach((address) =>
      groupEvent(address, groups, event)
    );
    return groups;
  };

  const groupedEvents = events.reduce(groupEvents, {});

  return groupedEvents;
};

exports.validatePrices = (prices) => {
  const isValidPrices = prices.every((price) => price >= 0);

  if (!isValidPrices) {
    throw new RangeError("Token price cannot be negative");
  }
};

exports.isDepegged = (prices, tokenAddresses) => {
  if (prices.length !== tokenAddresses.length) {
    throw new Error("Price and token address arrays must be the same length");
  }

  const isDepegged = prices.some((price, i) => {
    const address = tokenAddresses[i];
    const threshold = DEPEG_THRESHOLDS[address];

    if (threshold === undefined) {
      throw new Error(`Depeg threshold not configured for token: ${address}`);
    }

    return price < threshold;
  });

  return isDepegged;
};

exports.getMatchesFromEvents = (events) => {
  const matches = events.map(({ hash }) => {
    return { hash };
  });

  return matches;
};

exports.getDepeggedMatchesForPoolAddress = async (
  poolAddress,
  groupedEvents
) => {
  const tokenAddresses = CURVE_POOLS[poolAddress];

  if (tokenAddresses === undefined) {
    throw new Error(`Tokens not configured for Curve pool: ${poolAddress}`);
  }

  const prices = await coingecko.getTokenPrice(tokenAddresses);

  exports.validatePrices(prices);

  const isDepegged = exports.isDepegged(prices, tokenAddresses);

  if (isDepegged) {
    return exports.getMatchesFromEvents(groupedEvents[poolAddress]);
  } else {
    return [];
  }
};

exports.getDepeggedMatchesForPoolAddresses = async (
  poolAddresses,
  groupedEvents
) => {
  const matchesForPoolAddresses = await Promise.all(
    poolAddresses.map((poolAddress) =>
      exports.getDepeggedMatchesForPoolAddress(poolAddress, groupedEvents)
    )
  );

  const matchesForPoolAddressesFiltered = matchesForPoolAddresses.filter(
    (match) => match.length > 0
  );

  return matchesForPoolAddressesFiltered;
};

exports.getUniquePoolAddresses = (events) => {
  const poolAddresses = [
    ...new Set(events.map((event) => event.matchedAddresses).flat()),
  ];

  const poolAddressesChecksum = poolAddresses.map(ethers.utils.getAddress);

  return poolAddressesChecksum;
};

exports.main = async (events) => {
  const poolAddresses = exports.getUniquePoolAddresses(events);

  const groupedEvents = exports.getGroupedEvents(events);

  const matchesForPoolAddresses =
    await exports.getDepeggedMatchesForPoolAddresses(
      poolAddresses,
      groupedEvents
    );

  const matches = matchesForPoolAddresses.flat();

  return matches;
};

// Entrypoint for the Autotask
exports.handler = async (payload) => {
  // Handler was triggered manually, by a schedule, or by a sentinel
  if (payload.request === undefined) {
    throw Error("Autotask should only be used to filter sentinel matches");
  }

  const conditionRequest = payload.request.body;
  const events = conditionRequest.events;

  const matches = await exports.main(events);

  return { matches };
};

// To run locally (this code will not be executed in Autotasks)
if (require.main === module) {
  const fs = require("fs");
  const stdin = fs.readFileSync(0, "utf-8");
  const payload = JSON.parse(stdin);

  exports
    .handler(payload) // pass in JSON from piped stdin
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

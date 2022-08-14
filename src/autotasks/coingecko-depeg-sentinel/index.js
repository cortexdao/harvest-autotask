const { ethers } = require("ethers");
const coingecko = require("../../common/coingecko");
const { DEPEG_THRESHOLDS, MUSD_ADDRESS } = require("../../common/constants");

exports.main = async (events) => {
  const matches = [];

  const price = await coingecko.getTokenPrice(MUSD_ADDRESS);

  if (price < 0) {
    throw new RangeError("Token price cannot be negative");
  }

  if (price < DEPEG_THRESHOLDS[MUSD_ADDRESS]) {
    for (const event of events) {
      matches.push({ hash: event.hash });
    }

    return matches;
  } else {
    return [];
  }
};

// Entrypoint for the Autotask
exports.handler = async (payload) => {
  const conditionRequest = payload.request.body;
  const events = conditionRequest.events;

  const matches = main(events);

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

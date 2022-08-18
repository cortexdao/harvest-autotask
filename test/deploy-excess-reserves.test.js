const { expect } = require("chai");

const { MetaPoolToken } = require("../src/common/mapt");
const {
  getExcessReserveIds,
} = require("../src/autotasks/deploy-excess-reserves/index");

const { RESERVE_POOLS, RESERVE_POOL_IDS } = require("../src/common/constants");

describe("Deploy excess reserves", () => {
  describe("getExcessReserveIds", () => {
    it("should return an empty array if provided an empty array", () => {
      const rebalanceAmounts = [];
      const reserveIds = getExcessReserveIds(rebalanceAmounts);
      expect(reserveIds).to.be.empty;
    });

    it("should return an empty array if no rebalance amounts are negative", () => {
      const addresses = Object.keys(RESERVE_POOLS);
      const rebalanceAmounts = [
        { address: addresses[0], amount: 10n },
        { address: addresses[1], amount: 10n },
        { address: addresses[2], amount: 10n },
      ];
      const reserveIds = getExcessReserveIds(rebalanceAmounts);
      expect(reserveIds).to.be.empty;
    });

    it("should only return the IDs of reserves that have a negative rebalance amount", () => {
      const addresses = Object.keys(RESERVE_POOLS);
      const rebalanceAmounts = [
        { address: addresses[0], amount: -10n },
        { address: addresses[1], amount: -10n },
        { address: addresses[2], amount: 10n },
      ];
      const reserveIds = getExcessReserveIds(rebalanceAmounts);

      const expectedReserveIds = [RESERVE_POOL_IDS[0], RESERVE_POOL_IDS[1]];
      expect(reserveIds).to.deep.equal(expectedReserveIds);
    });
  });
});

const { expect, use } = require("chai");
const chaiAsPromised = require("chai-as-promised");
const sinon = require("sinon");
const {
  DAI_ADDRESS,
  USDC_ADDRESS,
  USDT_ADDRESS,
  THREEPOOL_STABLESWAP_ADDRESS,
  MUSD_STABLESWAP_ADDRESS,
  FRAX_STABLESWAP_ADDRESS,
  CURVE_POOLS,
} = require("../src/common/constants");
const coingecko = require("../src/common/coingecko");
const index = require("../src/autotasks/coingecko-depeg-sentinel/index");
const {
  getGroupedEvents,
  validatePrices,
  isDepegged,
  getMatchesFromEvents,
  getDepeggedMatchesForPoolAddress,
  getDepeggedMatchesForPoolAddresses,
  getUniquePoolAddresses,
  main,
} = index;

use(chaiAsPromised);

describe("Coingecko Depeg Sentinel", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("getGroupedEvents", () => {
    it("should group events by address", () => {
      const address1 = THREEPOOL_STABLESWAP_ADDRESS;
      const address2 = MUSD_STABLESWAP_ADDRESS;
      const address3 = FRAX_STABLESWAP_ADDRESS;

      const events = [
        { hash: "0x01", matchedAddresses: [address1] },
        { hash: "0x02", matchedAddresses: [address1, address2] },
        { hash: "0x03", matchedAddresses: [address3] },
        { hash: "0x04", matchedAddresses: [address2, address3] },
      ];
      const groupedEvents = getGroupedEvents(events);

      const expectedGroupedEvents = {
        [address1]: [events[0], events[1]],
        [address2]: [events[1], events[3]],
        [address3]: [events[2], events[3]],
      };

      expect(groupedEvents).to.deep.equal(expectedGroupedEvents);
    });

    it("should add an event to multiple groups if it has multiple addresses", () => {
      const address1 = THREEPOOL_STABLESWAP_ADDRESS;
      const address2 = MUSD_STABLESWAP_ADDRESS;
      const address3 = FRAX_STABLESWAP_ADDRESS;

      const events = [
        { hash: "0x01", matchedAddresses: [address1, address2, address3] },
      ];
      const groupedEvents = getGroupedEvents(events);

      const expectedGroupedEvents = {
        [address1]: [events[0]],
        [address2]: [events[0]],
        [address3]: [events[0]],
      };

      expect(groupedEvents).to.deep.equal(expectedGroupedEvents);
    });

    it("should add an event to a single group if it has one address", () => {
      const address1 = THREEPOOL_STABLESWAP_ADDRESS;

      const events = [{ hash: "0x01", matchedAddresses: [address1] }];
      const groupedEvents = getGroupedEvents(events);

      const expectedGroupedEvents = { [address1]: [events[0]] };

      expect(groupedEvents).to.deep.equal(expectedGroupedEvents);
    });

    it("should not add an event to any groups if it has zero addresses", () => {
      const events = [{ hash: "0x01", matchedAddresses: [] }];
      const groupedEvents = getGroupedEvents(events);

      expect(groupedEvents).to.be.empty;
    });

    it("should add multiple events to the same group if they have the same addresses", () => {
      const address1 = THREEPOOL_STABLESWAP_ADDRESS;

      const events = [
        { hash: "0x01", matchedAddresses: [address1] },
        { hash: "0x02", matchedAddresses: [address1] },
        { hash: "0x03", matchedAddresses: [address1] },
      ];
      const groupedEvents = getGroupedEvents(events);

      const expectedGroupedEvents = {
        [address1]: [events[0], events[1], events[2]],
      };

      expect(groupedEvents).to.deep.equal(expectedGroupedEvents);
    });
  });

  describe("validatePrices", () => {
    it("should throw an error if any of the prices are negative", () => {
      const prices = [1.0, -1.1, 1.2];
      expect(() => validatePrices(prices)).to.throw(RangeError);
    });

    it("should not throw an error if all the prices are greater than or equal to zero", () => {
      const prices = [1.0, 1.1, 1.2];
      expect(() => validatePrices(prices)).to.not.throw();
    });
  });

  describe("isDepegged", () => {
    it("should return true any if the prices are below the depeg threshold", () => {
      const prices = [0.7, 1.0, 1.0];
      const tokenAddresses = [DAI_ADDRESS, USDC_ADDRESS, USDT_ADDRESS];
      const result = isDepegged(prices, tokenAddresses);

      expect(result).to.be.true;
    });

    it("should return false all the prices are above the depeg threshold", () => {
      const prices = [1.0, 1.0, 1.0];
      const tokenAddresses = [DAI_ADDRESS, USDC_ADDRESS, USDT_ADDRESS];
      const result = isDepegged(prices, tokenAddresses);

      expect(result).to.be.false;
    });

    it("should throw an error if there is not a depeg threshold for one of the tokens", () => {
      const prices = [1.0, 1.0, 1.0];
      const fakeAddress = "0x0000000000000000000000000000000000000000";
      const tokenAddresses = [fakeAddress, USDC_ADDRESS, USDT_ADDRESS];

      expect(() => isDepegged(prices, tokenAddresses)).to.throw();
    });

    it("should throw an error if price array and token address array lengths do not match", () => {
      const extraPrices = [1.0, 1.0, 1.0, 4.0];
      const tokenAddresses = [DAI_ADDRESS, USDC_ADDRESS, USDT_ADDRESS];

      expect(() => isDepegged(extraPrices, tokenAddresses)).to.throw();

      const prices = [1.0, 1.0];
      const extraTokenAddresses = [DAI_ADDRESS, USDC_ADDRESS, USDT_ADDRESS];

      expect(() => isDepegged(prices, extraTokenAddresses)).to.throw();
    });
  });

  describe("getMatchesFromEvents", () => {
    it("should return an array with a match object for each event", () => {
      const events = [{ hash: "0x01" }, { hash: "0x02" }, { hash: "0x03" }];
      const matches = getMatchesFromEvents(events);

      const expectedMatches = events;
      expect(matches).to.deep.equal(expectedMatches);
    });

    it("should return an empty array if given an empty array of events", () => {
      const events = [];
      const matches = getMatchesFromEvents(events);

      const expectedMatches = [];
      expect(matches).to.deep.equal(expectedMatches);
    });

    it("should throw an error if events is undefined", () => {
      const events = undefined;
      expect(() => getMatchesFromEvents(events)).to.throw(TypeError);
    });
  });

  describe("getDepeggedMatchesForPoolAddress", () => {
    it("should check every token in the pool for a depeg", async () => {
      const prices = [1.0, 1.0, 1.0, 1.0];
      const getTokenPriceFake = sinon.replace(
        coingecko,
        "getTokenPrice",
        sinon.fake.resolves(prices)
      );

      const isDepeggedFake = sinon.replace(
        index,
        "isDepegged",
        sinon.fake.returns(false)
      );

      const poolAddress = MUSD_STABLESWAP_ADDRESS;
      const groupedEvents = {
        [MUSD_STABLESWAP_ADDRESS]: [{ hash: "0x01" }, { hash: "0x02" }],
      };
      await getDepeggedMatchesForPoolAddress(poolAddress, groupedEvents);

      // Should be four tokens in this pool
      const everyToken = CURVE_POOLS[MUSD_STABLESWAP_ADDRESS];
      const isEveryTokenPriced =
        getTokenPriceFake.calledOnceWithExactly(everyToken);
      expect(isEveryTokenPriced).to.be.true;

      const isEveryTokenChecked = isDepeggedFake.calledOnceWithExactly(
        prices,
        everyToken
      );
      expect(isEveryTokenChecked).to.be.true;
    });

    it("should return an empty array if there is no depeg for any token", async () => {
      const prices = [1.0, 1.0, 1.0, 1.0];
      const getTokenPriceFake = sinon.replace(coingecko, "getTokenPrice", () =>
        Promise.resolve(prices)
      );

      const poolAddress = MUSD_STABLESWAP_ADDRESS;
      const groupedEvents = {
        [MUSD_STABLESWAP_ADDRESS]: [{ hash: "0x01" }, { hash: "0x02" }],
      };

      const matches = await getDepeggedMatchesForPoolAddress(
        poolAddress,
        groupedEvents
      );

      expect(matches).to.be.empty;
    });

    it("should return matches for every event from the pool if there is a depeg", async () => {
      const prices = [0.7, 1.0, 1.0, 1.0];
      const getTokenPriceFake = sinon.replace(coingecko, "getTokenPrice", () =>
        Promise.resolve(prices)
      );

      const poolAddress = MUSD_STABLESWAP_ADDRESS;
      const groupedEvents = {
        [MUSD_STABLESWAP_ADDRESS]: [{ hash: "0x01" }, { hash: "0x02" }],
      };

      const matches = await getDepeggedMatchesForPoolAddress(
        poolAddress,
        groupedEvents
      );

      const expectedMatches = groupedEvents[MUSD_STABLESWAP_ADDRESS];
      expect(matches).to.deep.equal(expectedMatches);
    });

    it("should not return matches for events from the other pools if there is a depeg in the current pool", async () => {
      const prices = [1.0, 1.0, 1.0, 1.0];
      const getTokenPriceFake = sinon.replace(coingecko, "getTokenPrice", () =>
        Promise.resolve(prices)
      );

      const poolAddress = MUSD_STABLESWAP_ADDRESS;
      const otherPoolAddress = THREEPOOL_STABLESWAP_ADDRESS;
      const groupedEvents = {
        [MUSD_STABLESWAP_ADDRESS]: [{ hash: "0x01" }, { hash: "0x02" }],
        [otherPoolAddress]: [{ hash: "0x03" }, { hash: "0x04" }],
      };

      const matches = await getDepeggedMatchesForPoolAddress(
        poolAddress,
        groupedEvents
      );

      const excludedMatches = groupedEvents[otherPoolAddress];
      expect(matches).to.not.have.deep.members(excludedMatches);
    });

    it("should throw an error if the pool address has not been configured", async () => {
      const prices = [1.0, 1.0, 1.0, 1.0];
      const getTokenPriceFake = sinon.replace(coingecko, "getTokenPrice", () =>
        Promise.resolve(prices)
      );

      const otherPoolAddress = THREEPOOL_STABLESWAP_ADDRESS;
      const groupedEvents = {
        [otherPoolAddress]: [{ hash: "0x03" }, { hash: "0x04" }],
      };

      await expect(
        getDepeggedMatchesForPoolAddress(otherPoolAddress, groupedEvents)
      ).to.be.rejected;
    });
  });

  describe("getDepeggedMatchesForPoolAddresses", () => {
    it("should throw an error if any promise is rejected when getting matches for a pool address", async () => {
      const poolAddressReject = THREEPOOL_STABLESWAP_ADDRESS;
      const poolAddresses = [MUSD_STABLESWAP_ADDRESS, poolAddressReject];
      const groupedEvents = {
        [poolAddresses[0]]: [{ hash: "0x01" }, { hash: "0x02" }],
        [poolAddresses[1]]: [{ hash: "0x03" }, { hash: "0x04" }],
      };

      sinon.replace(index, "getDepeggedMatchesForPoolAddress", (address) =>
        address === poolAddressReject
          ? Promise.reject(new Error())
          : Promise.resolve(groupedEvents[address])
      );

      await expect(
        getDepeggedMatchesForPoolAddresses(poolAddresses, groupedEvents)
      ).to.be.rejected;
    });

    it("should return an array of the match arrays returned for each pool address", async () => {
      const otherPoolAddress = THREEPOOL_STABLESWAP_ADDRESS;
      const poolAddresses = [MUSD_STABLESWAP_ADDRESS, otherPoolAddress];
      const groupedEvents = {
        [poolAddresses[0]]: [{ hash: "0x01" }, { hash: "0x02" }],
        [poolAddresses[1]]: [{ hash: "0x03" }, { hash: "0x04" }],
      };

      sinon.replace(index, "getDepeggedMatchesForPoolAddress", (address) =>
        Promise.resolve(groupedEvents[address])
      );

      const matches = await getDepeggedMatchesForPoolAddresses(
        poolAddresses,
        groupedEvents
      );

      const expectedMatches = [
        groupedEvents[poolAddresses[0]],
        groupedEvents[poolAddresses[1]],
      ];
      expect(matches).to.deep.equal(expectedMatches);
    });

    it("should return an empty array if none of the pool address have depegged tokens", async () => {
      const otherPoolAddress = THREEPOOL_STABLESWAP_ADDRESS;
      const poolAddresses = [MUSD_STABLESWAP_ADDRESS, otherPoolAddress];
      const groupedEvents = {
        [poolAddresses[0]]: [{ hash: "0x01" }, { hash: "0x02" }],
        [poolAddresses[1]]: [{ hash: "0x03" }, { hash: "0x04" }],
      };

      sinon.replace(index, "getDepeggedMatchesForPoolAddress", (address) =>
        Promise.resolve([])
      );

      const matches = await getDepeggedMatchesForPoolAddresses(
        poolAddresses,
        groupedEvents
      );

      expect(matches).to.be.empty;
    });
  });

  describe("getUniquePoolAddresses", () => {
    it("should convert a nested array of addresses into a one-dimensional array", () => {
      const address1 = THREEPOOL_STABLESWAP_ADDRESS;
      const address2 = MUSD_STABLESWAP_ADDRESS;
      const address3 = FRAX_STABLESWAP_ADDRESS;

      const events = [
        { matchedAddresses: [address1, address2] },
        { matchedAddresses: [address3] },
        { matchedAddresses: [address1, address3] },
      ];

      const addresses = getUniquePoolAddresses(events);

      const expectedAddresses = [address1, address2, address3];
      expect(addresses).to.deep.equal(expectedAddresses);
    });

    it("should remove duplicate addresses from all arrays", () => {
      const address1 = THREEPOOL_STABLESWAP_ADDRESS;
      const address2 = MUSD_STABLESWAP_ADDRESS;
      const address3 = FRAX_STABLESWAP_ADDRESS;

      const events = [
        { matchedAddresses: [address1, address1] },
        { matchedAddresses: [address1] },
      ];

      const addresses = getUniquePoolAddresses(events);

      const expectedAddresses = [address1];
      expect(addresses).to.deep.equal(expectedAddresses);
    });
  });

  describe("main", () => {
    it("should flatten the nested array of matches from pools that have a depeg", async () => {
      const otherPoolAddress = THREEPOOL_STABLESWAP_ADDRESS;
      const events = [
        { hash: "0x01", matchedAddresses: [MUSD_STABLESWAP_ADDRESS] },
        { hash: "0x02", matchedAddresses: [MUSD_STABLESWAP_ADDRESS] },
        { hash: "0x03", matchedAddresses: [otherPoolAddress] },
        { hash: "0x04", matchedAddresses: [otherPoolAddress] },
      ];
      const depeggedMatches = [
        [{ hash: "0x01" }, { hash: "0x02" }],
        [{ hash: "0x03" }, { hash: "0x04" }],
      ];
      sinon.replace(index, "getDepeggedMatchesForPoolAddresses", () =>
        Promise.resolve(depeggedMatches)
      );

      const matches = await main(events);

      const expectedMatches = [
        { hash: "0x01" },
        { hash: "0x02" },
        { hash: "0x03" },
        { hash: "0x04" },
      ];

      expect(matches).to.deep.equal(expectedMatches);
    });

    it("should return an empty array if there was no depegs", async () => {
      const otherPoolAddress = THREEPOOL_STABLESWAP_ADDRESS;
      const events = [
        { hash: "0x01", matchedAddresses: [MUSD_STABLESWAP_ADDRESS] },
        { hash: "0x02", matchedAddresses: [MUSD_STABLESWAP_ADDRESS] },
        { hash: "0x03", matchedAddresses: [otherPoolAddress] },
        { hash: "0x04", matchedAddresses: [otherPoolAddress] },
      ];
      const depeggedMatches = [];
      sinon.replace(index, "getDepeggedMatchesForPoolAddresses", () =>
        Promise.resolve(depeggedMatches)
      );

      const matches = await main(events);

      expect(matches).to.be.empty;
    });

    it("should throw an error if there was a problem checking for depegs", async () => {
      const otherPoolAddress = THREEPOOL_STABLESWAP_ADDRESS;
      const events = [
        { hash: "0x01", matchedAddresses: [MUSD_STABLESWAP_ADDRESS] },
        { hash: "0x02", matchedAddresses: [MUSD_STABLESWAP_ADDRESS] },
        { hash: "0x03", matchedAddresses: [otherPoolAddress] },
        { hash: "0x04", matchedAddresses: [otherPoolAddress] },
      ];
      const depeggedMatches = [];
      sinon.replace(index, "getDepeggedMatchesForPoolAddresses", () =>
        Promise.reject(new Error())
      );

      await expect(main(events)).to.be.rejected;
    });
  });
});

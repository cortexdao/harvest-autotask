const { expect } = require("chai");
const sinon = require("sinon");
const {
  impersonateAccount,
  stopImpersonatingAccount,
  setBalance,
  takeSnapshot,
} = require("@nomicfoundation/hardhat-network-helpers");

const { MetaPoolToken } = require("../src/common/mapt");
const { addOwnerWithThreshold } = require("./utils");
const index = require("../src/autotasks/deploy-excess-reserves/index");
const { getExcessReserveIds, main, handler } = index;

const {
  LP_SAFE_ADDRESS,
  RESERVE_POOLS,
  RESERVE_POOL_IDS,
} = require("../src/common/constants");

describe("Deploy excess reserves", () => {
  let initialSnapshot;
  let snapshot;
  let signer;

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  afterEach(() => {
    sinon.restore();
  });

  before(async () => {
    initialSnapshot = await takeSnapshot();
  });

  before(async () => {
    [signer] = await ethers.getSigners();
  });

  before(async () => {
    await addOwnerWithThreshold(signer.address);
  });

  after(async () => {
    await initialSnapshot.restore();
  });

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

  describe("main", () => {
    it("should return a tx receipt", async () => {
      const receipt = await main(signer);
      expect(receipt).to.include.all.keys("to", "from", "transactionHash");
    });
  });

  const { RELAY_API_KEY: apiKey, RELAY_API_SECRET: apiSecret } = process.env;
  if (apiKey && apiSecret) {
    describe("handler", () => {
      it("should return a tx receipt from main", async () => {
        const expectedReceipt = {
          to: ethers.constants.AddressZero,
          from: ethers.constants.AddressZero,
          transactionHash: "0x0",
        };
        sinon.replace(index, "main", () => Promise.resolve(expectedReceipt));

        const receipt = await handler({ apiKey, apiSecret });

        expect(receipt).to.deep.equal(expectedReceipt);
      });
    });
  }
});

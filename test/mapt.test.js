const { expect, use } = require("chai");
const {
  impersonateAccount,
  stopImpersonatingAccount,
  setBalance,
  takeSnapshot,
} = require("@nomicfoundation/hardhat-network-helpers");
const { smock } = require("@defi-wonderland/smock");

const { MetaPoolToken } = require("../src/common/mapt");

const {
  LP_SAFE_ADDRESS,
  RESERVE_POOLS,
  RESERVE_POOL_IDS,
} = require("../src/common/constants");

const maptAbi = require("../src/abis/MetaPoolTokenV2.json");

use(smock.matchers);

describe("MetaPoolToken", () => {
  let snapshot;
  let signer;
  let mapt;

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  before(async () => {
    [signer] = await ethers.getSigners();
    mapt = new MetaPoolToken(signer);
  });

  describe("getRebalanceAmounts", () => {
    it("should return Array<{ address: string, amount: BigInt }>", async () => {
      const reserveAddresses = Object.keys(RESERVE_POOLS);

      const callResults = [
        [reserveAddresses[0], reserveAddresses[1], reserveAddresses[2]],
        [10n, -20n, 30n],
      ];

      const contractFake = await smock.fake(maptAbi, {
        address: mapt.contract.address,
      });
      contractFake.getRebalanceAmounts.returns(callResults);

      const rebalanceAmounts = await mapt.getRebalanceAmounts();

      const expectedRebalanceAmounts = [
        { address: reserveAddresses[0], amount: 10n },
        { address: reserveAddresses[1], amount: -20n },
        { address: reserveAddresses[2], amount: 30n },
      ];

      expect(rebalanceAmounts).to.deep.equal(expectedRebalanceAmounts);
    });
  });

  describe("createFundLpAccountTx", () => {
    let safeSigner;
    let maptWithSafeSigner;

    before(async () => {
      await impersonateAccount(LP_SAFE_ADDRESS);
      await setBalance(LP_SAFE_ADDRESS, 10n ** 18n);
      safeSigner = await ethers.getSigner(LP_SAFE_ADDRESS);
      maptWithSafeSigner = new MetaPoolToken(safeSigner);
    });

    after(async () => {
      await stopImpersonatingAccount(LP_SAFE_ADDRESS);
    });

    it("should return a populated tx object", async () => {
      const reserveIds = RESERVE_POOL_IDS;
      const tx = await maptWithSafeSigner.createFundLpAccountTx(reserveIds);
      expect(tx).to.include.all.keys("to", "data", "value");
    });
  });
});

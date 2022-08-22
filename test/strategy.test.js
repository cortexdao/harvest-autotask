const { expect, use } = require("chai");
const chaiAsPromised = require("chai-as-promised");
const sinon = require("sinon");
const {
  impersonateAccount,
  stopImpersonatingAccount,
  setBalance,
  takeSnapshot,
} = require("@nomicfoundation/hardhat-network-helpers");

const { Strategy } = require("../src/common/strategy");

const { forceTransfer } = require("./utils");
const {
  LP_SAFE_ADDRESS,
  ADMIN_SAFE_ADDRESS,
  THREEPOOL_STABLESWAP_ADDRESS,
  LP_ACCOUNT_ADDRESS,
  USDC_ADDRESS,
  RESERVE_POOLS,
} = require("../src/common/constants");

const erc20Abi = require("../src/abis/ERC20.json");
const poolTokenAbi = require("../src/abis/PoolTokenV3.json");

use(chaiAsPromised);

describe("Index strategy", () => {
  let snapshot;
  let signer;

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

  before(async () => {
    [signer] = await ethers.getSigners();
  });

  before(() => {
    strategy = new Strategy(signer);
  });

  describe("getUnderlyersWithNetExcess", () => {
    it("should return an empty array if every token's rebalance amount is greater its balance", () => {
      const reserveAddresses = Object.keys(RESERVE_POOLS);

      const rebalanceAmounts = [
        { address: reserveAddresses[0], amount: 50000n },
        { address: reserveAddresses[1], amount: 50000n },
        { address: reserveAddresses[2], amount: 50000n },
      ];

      const reserveValues = Object.values(RESERVE_POOLS);

      const balances = {
        [reserveValues[0].underlyer]: 10000n,
        [reserveValues[1].underlyer]: 10000n,
        [reserveValues[2].underlyer]: 10000n,
      };

      const netExcessAmounts = strategy.getUnderlyersWithNetExcess(
        rebalanceAmounts,
        balances
      );

      expect(netExcessAmounts).to.be.empty;
    });

    it("should calculate the difference between the token's balance and the rebalance amount", () => {
      const reserveAddresses = Object.keys(RESERVE_POOLS);

      const rebalanceAmounts = [
        { address: reserveAddresses[0], amount: 10000n },
        { address: reserveAddresses[1], amount: 10000n },
        { address: reserveAddresses[2], amount: 10000n },
      ];

      const reserveValues = Object.values(RESERVE_POOLS);

      const balances = {
        [reserveValues[0].underlyer]: 50000n,
        [reserveValues[1].underlyer]: 50000n,
        [reserveValues[2].underlyer]: 50000n,
      };

      const netExcessAmounts = strategy.getUnderlyersWithNetExcess(
        rebalanceAmounts,
        balances
      );

      const underlying = Object.keys(balances);

      const expectedNetExcessAmounts = [
        { address: underlying[0], amount: 40000n },
        { address: underlying[1], amount: 40000n },
        { address: underlying[2], amount: 40000n },
      ];
      expect(netExcessAmounts).to.deep.equal(expectedNetExcessAmounts);
    });

    it("should return an array that excludes any net amounts that are negative", () => {
      const reserveAddresses = Object.keys(RESERVE_POOLS);

      const rebalanceAmounts = [
        { address: reserveAddresses[0], amount: 10000n },
        { address: reserveAddresses[1], amount: 10000n },
        { address: reserveAddresses[2], amount: 50000n },
      ];

      const reserveValues = Object.values(RESERVE_POOLS);

      const balances = {
        [reserveValues[0].underlyer]: 50000n,
        [reserveValues[1].underlyer]: 50000n,
        [reserveValues[2].underlyer]: 10000n,
      };

      const netExcessAmounts = strategy.getUnderlyersWithNetExcess(
        rebalanceAmounts,
        balances
      );

      const underlying = Object.keys(balances);

      const expectedNetExcessAmounts = [
        { address: underlying[0], amount: 40000n },
        { address: underlying[1], amount: 40000n },
      ];
      expect(netExcessAmounts).to.deep.equal(expectedNetExcessAmounts);
    });

    it("should throw an error if a rebalance amount uses an unconfigured reserve pool", () => {
      const reserveAddresses = Object.keys(RESERVE_POOLS);

      const rebalanceAmounts = [
        { address: reserveAddresses[0], amount: 10000n },
        { address: reserveAddresses[1], amount: 10000n },
        { address: ethers.constants.AddressZero, amount: 10000n },
      ];

      const reserveValues = Object.values(RESERVE_POOLS);

      const balances = {
        [reserveValues[0].underlyer]: 50000n,
        [reserveValues[1].underlyer]: 50000n,
        [reserveValues[2].underlyer]: 50000n,
      };

      expect(() =>
        strategy.getUnderlyersWithNetExcess(rebalanceAmounts, balances)
      ).to.throw(TypeError);
    });

    it("should throw an error if a rebalance amount's underlyer does not have a corresponding balance", () => {
      const reserveAddresses = Object.keys(RESERVE_POOLS);

      const rebalanceAmounts = [
        { address: reserveAddresses[0], amount: 10000n },
        { address: reserveAddresses[1], amount: 10000n },
        { address: reserveAddresses[2], amount: 10000n },
      ];

      const reserveValues = Object.values(RESERVE_POOLS);

      const balances = {
        [reserveValues[0].underlyer]: 50000n,
        [reserveValues[1].underlyer]: 50000n,
      };

      expect(() =>
        strategy.getUnderlyersWithNetExcess(rebalanceAmounts, balances)
      ).to.throw(TypeError);
    });
  });
});

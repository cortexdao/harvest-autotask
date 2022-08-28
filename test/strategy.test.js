const _ = require("lodash");
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

const { toBigInt } = require("../src/common/utils");
const { forceTransfer, setReservePercentage } = require("./utils");

const {
  LP_SAFE_ADDRESS,
  LP_ACCOUNT_ADDRESS,
  DAI_ADDRESS,
  USDC_ADDRESS,
  USDT_ADDRESS,
  THREEPOOL_STABLESWAP_ADDRESS,
  RESERVE_POOLS,
  MAX_ADD_LIQUIDITY,
} = require("../src/common/constants");

const erc20Abi = require("../src/abis/ERC20.json");

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

  afterEach(() => {
    sinon.restore();
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

  describe("getLargestTokenAmount", () => {
    it("should return the token amount with the largest net excess", async () => {
      const tokenAmounts = [
        { address: DAI_ADDRESS, amount: 100n * 10n ** 18n },
        { address: USDC_ADDRESS, amount: 400n * 10n ** 6n },
        { address: USDT_ADDRESS, amount: 200n * 10n ** 6n },
      ];

      const largestAmount = await strategy.getLargestTokenAmount(tokenAmounts);

      const expectedLargestAmount = {
        address: USDC_ADDRESS,
        amount: 400n * 10n ** 18n,
      };
      expect(largestAmount).to.deep.equal(expectedLargestAmount);
    });
  });

  describe("getNextBalanceAmount", () => {
    it("should throw an Error if there are no reserves and balances in net excess", async () => {
      const reserveAddresses = Object.keys(RESERVE_POOLS);

      const rebalanceAmounts = [
        { address: reserveAddresses[0], amount: 500n * 10n ** 18n },
        { address: reserveAddresses[1], amount: 500n * 10n ** 6n },
        { address: reserveAddresses[2], amount: 500n * 10n ** 6n },
      ];
      sinon.replace(strategy.mapt, "getRebalanceAmounts", () =>
        Promise.resolve(rebalanceAmounts)
      );

      const balances = {
        [DAI_ADDRESS]: 100n * 10n ** 18n,
        [USDC_ADDRESS]: 100n * 10n ** 6n,
        [USDT_ADDRESS]: 100n * 10n ** 6n,
      };
      sinon.replace(strategy.lpAccount, "getUnderlyerBalances", () =>
        Promise.resolve(balances)
      );

      await expect(strategy.getNextBalanceAmount()).to.be.rejectedWith(Error);
    });

    it("should return the amount that can be added to an index position from the token that has the largest reserves in excess", async () => {
      const reserveAddresses = Object.keys(RESERVE_POOLS);

      const rebalanceAmounts = [
        { address: reserveAddresses[0], amount: 100n * 10n ** 18n },
        { address: reserveAddresses[1], amount: 100n * 10n ** 6n },
        { address: reserveAddresses[2], amount: 100n * 10n ** 6n },
      ];
      sinon.replace(strategy.mapt, "getRebalanceAmounts", () =>
        Promise.resolve(rebalanceAmounts)
      );

      const balances = {
        [DAI_ADDRESS]: 50n * 10n ** 18n,
        [USDC_ADDRESS]: 500n * 10n ** 6n,
        [USDT_ADDRESS]: -100n * 10n ** 6n,
      };
      sinon.replace(strategy.lpAccount, "getUnderlyerBalances", () =>
        Promise.resolve(balances)
      );

      const nextBalanceAmount = await strategy.getNextBalanceAmount();

      const expectedNextBalanceAmount = {
        address: USDC_ADDRESS,
        amount: 500n * 10n ** 6n,
      };
      expect(nextBalanceAmount).to.deep.equal(expectedNextBalanceAmount);
    });
  });

  describe("getTargetValues", () => {
    it("should return all zero target values when there are no positions", () => {
      const positions = [];
      const targetWeights = [
        { name: "convex-3pool", weight: toBigInt("0.20", 8) },
        { name: "convex-frax", weight: toBigInt("0.30", 8) },
        { name: "convex-susdv2", weight: toBigInt("0.50", 8) },
      ];

      const targetValues = strategy.getTargetValues(positions, targetWeights);

      const expectedTargetValues = {
        "convex-3pool": 0n,
        "convex-frax": 0n,
        "convex-susdv2": 0n,
      };
      expect(targetValues).to.deep.equal(expectedTargetValues);
    });

    it("should return the target values for each index position", () => {
      const positions = [
        { name: "convex-3pool", value: 100n },
        { name: "convex-frax", value: 100n },
        { name: "convex-susdv2", value: 100n },
      ];

      const targetWeights = [
        { name: "convex-3pool", weight: toBigInt("0.20", 8) },
        { name: "convex-frax", weight: toBigInt("0.30", 8) },
        { name: "convex-susdv2", weight: toBigInt("0.50", 8) },
      ];

      const targetValues = strategy.getTargetValues(positions, targetWeights);

      const expectedTargetValues = {
        "convex-3pool": 60n,
        "convex-frax": 90n,
        "convex-susdv2": 150n,
      };
      expect(targetValues).to.deep.equal(expectedTargetValues);
    });
  });

  describe("getPositionDeltas", () => {
    it("should get the delta between each position value and it's target value", () => {
      const positions = [
        { name: "convex-3pool", value: 100n },
        { name: "convex-frax", value: 100n },
        { name: "convex-susdv2", value: 100n },
      ];
      const targetValues = {
        "convex-3pool": 60n,
        "convex-frax": 90n,
        "convex-susdv2": 150n,
      };

      const deltas = strategy.getPositionDeltas(positions, targetValues);

      const expectedDeltas = [
        { name: "convex-3pool", delta: -40n },
        { name: "convex-frax", delta: -10n },
        { name: "convex-susdv2", delta: 50n },
      ];

      expect(deltas).to.deep.equal(expectedDeltas);
    });

    it("should assume a position's target value is zero when there is no specified target weight", () => {
      const positions = [
        { name: "convex-3pool", value: 100n },
        { name: "convex-frax", value: 100n },
        { name: "convex-susdv2", value: 100n },
      ];
      const targetValues = {
        "convex-frax": 90n,
        "convex-susdv2": 150n,
      };

      const deltas = strategy.getPositionDeltas(positions, targetValues);

      const expectedDeltas = [
        { name: "convex-3pool", delta: -100n },
        { name: "convex-frax", delta: -10n },
        { name: "convex-susdv2", delta: 50n },
      ];

      expect(deltas).to.deep.equal(expectedDeltas);
    });

    it("should assume a position's current value is zero if there is no position", () => {
      const positions = [
        { name: "convex-3pool", value: 100n },
        { name: "convex-frax", value: 100n },
      ];
      const targetValues = {
        "convex-3pool": 40n,
        "convex-frax": 60n,
        "convex-susdv2": 100n,
      };

      const deltas = strategy.getPositionDeltas(positions, targetValues);

      const expectedDeltas = [
        { name: "convex-3pool", delta: -60n },
        { name: "convex-frax", delta: -40n },
        { name: "convex-susdv2", delta: 100n },
      ];

      expect(deltas).to.deep.equal(expectedDeltas);
    });

    it("should calculate the correct delta even when the total positions does not equal the total values", () => {
      const positions = [
        { name: "convex-3pool", value: 100n },
        { name: "convex-frax", value: 100n },
      ];
      const targetValues = {
        "convex-3pool": 200n,
        "convex-frax": 60n,
        "convex-susdv2": 100n,
      };

      const deltas = strategy.getPositionDeltas(positions, targetValues);

      const expectedDeltas = [
        { name: "convex-3pool", delta: 100n },
        { name: "convex-frax", delta: -40n },
        { name: "convex-susdv2", delta: 100n },
      ];

      expect(deltas).to.deep.equal(expectedDeltas);
    });
  });

  describe("getNextPosition", () => {
    beforeEach(() => {
      const tokenPrices = {
        "0x6B175474E89094C44Da98b954EedeAC495271d0F": 1.0,
        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": 1.0,
        "0xdAC17F958D2ee523a2206206994597C13D831ec7": 1.0,
        "0x57Ab1ec28D129707052df4dF418D58a2D46d5f51": 1.0,
        "0x853d955aCEf822Db058eb8505911ED77F175b99e": 1.0,
        "0x5f98805A4E8be255a32880FDeC7F6728C6568bA0": 1.0,
        "0xBC6DA0FE9aD5f3b0d58160288917AA56653660E9": 1.0,
        "0x99D8a9C45b2ecA8864373A26D1459e3Dff1e17F3": 1.0,
        "0x2A8e1E676Ec238d8A992307B495b45B3fEAa5e86": 1.0,
      };

      const getAllocationTokenPricesFake = () => Promise.resolve(tokenPrices);
      sinon.replace(
        strategy.tvlManager,
        "getAllocationTokenPrices",
        getAllocationTokenPricesFake
      );
    });

    it("should get the position with the largest delta between the current and target value", async () => {
      const position = await strategy.getNextPosition();
      expect(position).to.include.all.keys("name", "value", "tokens");
      expect(position.name).to.equal("convex-dola");
    });

    it("should use the position's current value and not the delta", async () => {
      const position = await strategy.getNextPosition();

      const [expectedValue] = _.map(
        await strategy.tvlManager.getIndexPositions([position.name]),
        "value"
      );

      expect(position.value).to.equal(expectedValue);
    });

    it("should throw an error if there is no valid next position", async () => {
      sinon.replace(strategy, "getPositionDeltas", () => []);
      await expect(strategy.getNextPosition()).to.be.rejected;
    });

    it("should get the next position if there are target values, even if there are no positions", async () => {
      sinon.replace(strategy.tvlManager, "getIndexPositions", () =>
        Promise.resolve([])
      );

      const targetValues = {
        "convex-3pool": 40n,
        "convex-frax": 60n,
        "convex-susdv2": 100n,
      };
      sinon.replace(strategy, "getTargetValues", () => targetValues);

      const position = await strategy.getNextPosition();

      const expectedPositionName = "convex-susdv2";
      expect(position.name).to.equal(expectedPositionName);
    });
  });

  describe("getPossibleNextAddLiquidityValues", () => {
    it("should return a percentage of the total position value as the first element", async () => {
      const nextBalanceAmount = {
        address: USDC_ADDRESS,
        amount: 50000n * 10n ** 6n,
      };
      const nextPosition = { value: 100000n * 10n ** 8n };

      const nextValues = await strategy.getPossibleNextAddLiquidityValues(
        nextBalanceAmount,
        nextPosition
      );

      const expected = 20000n * 10n ** 8n;
      expect(nextValues[0]).to.equal(expected);
    });

    it("should return the balance available on the LP Account in USD decimals as the second element", async () => {
      const nextBalanceAmount = {
        address: USDC_ADDRESS,
        amount: 50000n * 10n ** 6n,
      };
      const nextPosition = { value: 100000n * 10n ** 8n };

      const nextValues = await strategy.getPossibleNextAddLiquidityValues(
        nextBalanceAmount,
        nextPosition
      );

      const expected = 50000n * 10n ** 8n;
      expect(nextValues[1]).to.equal(expected);
    });

    it("should return the maximum cap for adding liquidity as the third element", async () => {
      const nextBalanceAmount = {
        address: USDC_ADDRESS,
        amount: 50000n * 10n ** 6n,
      };
      const nextPosition = { value: 100000n * 10n ** 8n };

      const nextValues = await strategy.getPossibleNextAddLiquidityValues(
        nextBalanceAmount,
        nextPosition
      );

      const expected = MAX_ADD_LIQUIDITY;
      expect(nextValues[2]).to.equal(expected);
    });
  });

  describe("getNextAddLiquidityTx", () => {
    let safeSigner;
    let strategyWithSafeSigner;

    before(async () => {
      await setReservePercentage(5);
    });

    before(async () => {
      await impersonateAccount(LP_SAFE_ADDRESS);
      await setBalance(LP_SAFE_ADDRESS, 10n ** 18n);
      safeSigner = await ethers.getSigner(LP_SAFE_ADDRESS);
      strategyWithSafeSigner = new Strategy(safeSigner);
    });

    after(async () => {
      await stopImpersonatingAccount(LP_SAFE_ADDRESS);
    });

    it("should throw an error if it is not possible to add liquidity", async () => {
      await setReservePercentage(1000);
      await expect(strategyWithSafeSigner.getNextAddLiquidityTx()).to.rejected;
    });

    it("should return a populated tx object if it is possible to add liquidity", async () => {
      const usdc = new ethers.Contract(USDC_ADDRESS, erc20Abi, signer);
      const extraUsdcBalance = 100000n * 10n ** 6n;
      await forceTransfer(
        usdc,
        THREEPOOL_STABLESWAP_ADDRESS,
        LP_ACCOUNT_ADDRESS,
        extraUsdcBalance
      );

      const tx = await strategyWithSafeSigner.getNextAddLiquidityTx();
      expect(tx).to.include.all.keys("to", "data", "value");
    });
  });
});

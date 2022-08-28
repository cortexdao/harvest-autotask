const { expect } = require("chai");
const sinon = require("sinon");
const {
  impersonateAccount,
  stopImpersonatingAccount,
  setBalance,
  takeSnapshot,
} = require("@nomicfoundation/hardhat-network-helpers");

const index = require("../src/autotasks/add-liquidity/index");
const { main, handler } = index;
const { LpAccount } = require("../src/common/lpaccount");

const {
  addOwnerWithThreshold,
  forceTransfer,
  setReservePercentage,
} = require("./utils");
const {
  ADMIN_SAFE_ADDRESS,
  THREEPOOL_STABLESWAP_ADDRESS,
  LP_ACCOUNT_ADDRESS,
  USDC_ADDRESS,
  RESERVE_POOLS,
} = require("../src/common/constants");

const erc20Abi = require("../src/abis/ERC20.json");
const poolTokenAbi = require("../src/abis/PoolTokenV3.json");

describe("Add liquidity to index", () => {
  let snapshot;
  let signer;

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  beforeEach(async () => {
    await addOwnerWithThreshold(signer.address);
  });

  beforeEach(async () => {
    await setReservePercentage(5);
  });

  beforeEach(async () => {
    const usdc = new ethers.Contract(USDC_ADDRESS, erc20Abi, signer);
    const extraUsdcBalance = 100000n * 10n ** 6n;
    await forceTransfer(
      usdc,
      THREEPOOL_STABLESWAP_ADDRESS,
      LP_ACCOUNT_ADDRESS,
      extraUsdcBalance
    );
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

  describe("main", () => {
    it("should return a tx receipt", async () => {
      // Drop a bunch of tokens in the LpAccount and set the reserve size
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

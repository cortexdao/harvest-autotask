const { expect } = require("chai");
const {
  createTx,
  convertTokenAmountDecimals,
  normalizeTokenAmounts,
} = require("../src/common/utils");

const {
  DAI_ADDRESS,
  USDC_ADDRESS,
  USDT_ADDRESS,
} = require("../src/common/constants");

const erc20Abi = require("../src/abis/ERC20.json");

describe("Utilities", () => {
  let signer;

  before(async () => {
    [signer] = await ethers.getSigners();
  });

  describe("createTx", () => {
    it("should return a tx object", () => {
      const erc20 = new ethers.Contract(USDC_ADDRESS, erc20Abi, signer);
      const tx = createTx(erc20, "transfer", [USDC_ADDRESS, 100n * 10n ** 6n]);
      expect(tx).to.include.all.keys("to", "data", "value");
    });
  });

  describe("convertTokenAmountDecimals", () => {
    it("should convert a token amount's decimals to the supplied decimals", async () => {
      const tokenAmount = {
        address: USDC_ADDRESS,
        amount: 100n * 10n ** 6n,
      };
      const decimals = 18n;
      const convertedTokenAmount = await convertTokenAmountDecimals(
        tokenAmount,
        decimals,
        signer
      );

      const expectedTokenAmount = {
        address: USDC_ADDRESS,
        amount: 100n * 10n ** decimals,
      };
      expect(convertedTokenAmount).to.deep.equal(expectedTokenAmount);
    });
  });

  describe("normalizeTokenAmounts", () => {
    it("should return the results of convertTokenAmountDecimals for each token amount", async () => {
      const tokenAmounts = [
        { address: DAI_ADDRESS, amount: 100n * 10n ** 18n },
        { address: USDC_ADDRESS, amount: 100n * 10n ** 6n },
        { address: USDT_ADDRESS, amount: 100n * 10n ** 6n },
      ];
      const decimals = 18n;

      const normalizedAmounts = normalizeTokenAmounts(
        tokenAmounts,
        decimals,
        signer
      );

      const expectedTokenAmounts = [
        { address: DAI_ADDRESS, amount: 100n * 10n ** decimals },
        { address: USDC_ADDRESS, amount: 100n * 10n ** decimals },
        { address: USDT_ADDRESS, amount: 100n * 10n ** decimals },
      ];
    });
  });
});

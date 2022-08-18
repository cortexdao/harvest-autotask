const { expect } = require("chai");
const { createTx } = require("../src/common/utils");

const { USDC_ADDRESS } = require("../src/common/constants");

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
});

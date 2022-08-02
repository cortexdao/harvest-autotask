const { expect } = require("chai");
const { getLpBalances } = require("../index");

const { LP_ACCOUNT_ADDRESS, LP_ACCOUNT_ABI } = require("../constants");

describe("Harvest Autotask", () => {
  let signer;
  let lpAccount

  before(async () => {
    [signer] = await ethers.getSigners();
    lpAccount = new ethers.Contract(LP_ACCOUNT_ADDRESS, LP_ACCOUNT_ABI, signer);
  });

  describe("getLpBalances", () => {
    it("should return balances for all zap names", async () => {
      const zapNames = ["convex-frax", "convex-susdv2", "convex-mim"];
      const balances = await getLpBalances(lpAccount, zapNames);
      expect(balances).to.have.lengthOf(zapNames.length);
    });

    it("should return 0 balances for all unregistered zap names", async () => {
      const zapNames = ["convex-frax", "convex-susdv2", "convex-mim", "invalid"];
      const balances = await getLpBalances(lpAccount, zapNames);
      expect(balances[3]).to.equal(0);
    });

    it("should return positive balances for all registered zap names with an active position", async () => {
      const zapNames = ["convex-frax", "convex-susdv2", "convex-mim"];
      const balances = await getLpBalances(lpAccount, zapNames);
      expect(balances).to.satisfy(balances => balances.every(balance => balance.gt(0)));
    });
  });
});

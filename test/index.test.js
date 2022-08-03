const { expect } = require("chai");
const { getLpBalances, getClaimNames } = require("../index");

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

  describe("getClaimNames", () => {
    it("should throw an error if the number of zap names do not match the number of balances", async () => {
      const zapNames = ["convex-frax", "convex-susdv2", "convex-mim"];
      const balances = [
        ethers.BigNumber.from(0),
        ethers.BigNumber.from(1),
        ethers.BigNumber.from(2),
        ethers.BigNumber.from(3),
      ];
      expect(() => getClaimNames(zapNames, balances)).to.throw(Error);
    });

    it("should throw a TypeError if balances are not BigNumbers", async () => {
      const zapNames = ["convex-frax", "convex-susdv2", "convex-mim"];
      const balances = [0, 1, 2]
      expect(() => getClaimNames(zapNames, balances)).to.throw(TypeError);
    });

    it("should only return zap names that had a positive balance", async () => {
      const zapNames = ["convex-frax", "convex-susdv2", "convex-mim"];
      const balances = [
        ethers.BigNumber.from(0),
        ethers.BigNumber.from(1),
        ethers.BigNumber.from(2),
      ];
      const claimNames = getClaimNames(zapNames, balances);

      const expectedClaimNames = ["convex-susdv2", "convex-mim"];
      expect(claimNames).to.deep.equal(expectedClaimNames);
    });
  });
});

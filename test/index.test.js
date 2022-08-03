const { expect } = require("chai");
const { impersonateAccount, setBalance } = require("@nomicfoundation/hardhat-network-helpers");
const { getLpBalances, getClaimNames, claim } = require("../index");

const {
  LP_SAFE_ADDRESS,
  LP_ACCOUNT_ADDRESS,
  LP_ACCOUNT_ABI,
  CRV_ADDRESS,
  CVX_ADDRESS,
  ERC20_ABI,
} = require("../constants");

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

  describe("claim", () => {
    let safeSigner;

    before(async () => {
      await impersonateAccount(LP_SAFE_ADDRESS);
      await setBalance(LP_SAFE_ADDRESS, 10n ** 18n);
      safeSigner = await ethers.getSigner(LP_SAFE_ADDRESS);
    });

    it("should claim CRV and CVX rewards", async () => {
      const crv = new ethers.Contract(CRV_ADDRESS, ERC20_ABI, safeSigner);
      const cvx = new ethers.Contract(CVX_ADDRESS, ERC20_ABI, safeSigner);

      // Expect non-zero change, because chai matcher cannot check for < or >
      await expect(claim(safeSigner))
        .to.not.changeTokenBalance(crv, LP_ACCOUNT_ADDRESS, 0)
        .and.not.changeTokenBalance(cvx, LP_ACCOUNT_ADDRESS, 0);
    });

    it("should return a tx receipt", async () => {
      const tx = await claim(safeSigner);
      expect(tx).to.include.all.keys('hash', 'blockNumber', 'from', 'to', 'data');
    });
  });
});

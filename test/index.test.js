const { expect, use } = require("chai");
const {
  impersonateAccount,
  stopImpersonatingAccount,
  setBalance,
  takeSnapshot,
} = require("@nomicfoundation/hardhat-network-helpers");
const { smock } = require("@defi-wonderland/smock");
const { getLpBalances, getClaimNames, createClaimTx } = require("../index");
const { main } = require("../index");

const {
  LP_SAFE_ADDRESS,
  LP_ACCOUNT_ADDRESS,
  LP_ACCOUNT_ABI,
  CRV_ADDRESS,
  CVX_ADDRESS,
  ERC20_ABI,
} = require("../constants");

use(smock.matchers);

describe("Harvest Autotask", () => {
  let snapshot;
  let signer;
  let lpAccount;

  beforeEach(async () => {
    snapshot = await takeSnapshot();
  });

  afterEach(async () => {
    await snapshot.restore();
  });

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
      const zapNames = [
        "convex-frax",
        "convex-susdv2",
        "convex-mim",
        "invalid",
      ];
      const balances = await getLpBalances(lpAccount, zapNames);
      expect(balances[3]).to.equal(0);
    });

    it("should return positive balances for all registered zap names with an active position", async () => {
      const zapNames = ["convex-frax", "convex-susdv2", "convex-mim"];
      const balances = await getLpBalances(lpAccount, zapNames);
      expect(balances).to.satisfy((balances) =>
        balances.every((balance) => balance.gt(0))
      );
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
      const balances = [0, 1, 2];
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

    after(async () => {
      await stopImpersonatingAccount(LP_SAFE_ADDRESS);
    });

    it("should return a populated tx object", async () => {
      const tx = await createClaimTx(safeSigner);
      expect(tx).to.include.all.keys("to", "data", "value");
    });

    it("should claim CRV and CVX rewards", async () => {
      const crv = new ethers.Contract(CRV_ADDRESS, ERC20_ABI, safeSigner);
      const cvx = new ethers.Contract(CVX_ADDRESS, ERC20_ABI, safeSigner);

      const tx = await createClaimTx(safeSigner);

      // Expect non-zero change, because chai matcher cannot check for < or >
      await expect(safeSigner.sendTransaction(tx))
        .to.not.changeTokenBalance(crv, LP_ACCOUNT_ADDRESS, 0)
        .and.not.changeTokenBalance(cvx, LP_ACCOUNT_ADDRESS, 0);
    });
  });

  describe("main", () => {
    const ownerAddress = "0x893531C5E2c2af2a1F8DD03760843A3513f02AB8";
    let owner;

    before(async () => {
      await impersonateAccount(ownerAddress);
      await setBalance(ownerAddress, 10n ** 18n);
      owner = await ethers.getSigner(ownerAddress);
    });

    after(async () => {
      await stopImpersonatingAccount(ownerAddress);
    });

    it("should return a tx receipt", async () => {
      const receipt = await main(owner);
      expect(receipt).to.include.all.keys(
        "gasUsed",
        "blockHash",
        "transactionHash",
        "blockNumber"
      );
    });

    it("should have sufficient gas left", async () => {
      const receipt = await main(owner);
      const { gasUsed } = receipt;
      const { gasLimit } = await ethers.provider.getTransaction(
        receipt.transactionHash
      );
      const gasRemaining = gasLimit.sub(gasUsed);
      expect(gasRemaining).to.be.above(0);
    });

    it("should execute the transaction from the safe owner", async () => {
      const receipt = await main(owner);
      expect(receipt.from).to.equal(ownerAddress);
    });

    it("should call the `LpAccount` claim function", async () => {
      const lpAccountFake = await smock.fake(LP_ACCOUNT_ABI, {
        address: lpAccount.address,
      });
      lpAccountFake.claim.returns();

      await main(owner);

      expect(lpAccountFake.claim).to.have.called;
    });

    it("should not repay the safe owner for gas", async () => {
      expect(await main(owner)).to.changeEtherBalance(owner, 0);
    });
  });
});

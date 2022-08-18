const { expect, use } = require("chai");
const chaiAsPromised = require("chai-as-promised");
const sinon = require("sinon");
const {
  impersonateAccount,
  stopImpersonatingAccount,
  setBalance,
  takeSnapshot,
} = require("@nomicfoundation/hardhat-network-helpers");
const { smock } = require("@defi-wonderland/smock");

const coingecko = require("../src/common/coingecko");

const lpaccount = require("../src/common/lpaccount");
const {
  getLpBalances,
  getClaimNames,
  createClaimTx,
  getSwapAmountUsdValue,
  getSlippageUsdValue,
  getSwapMinAmount,
  createSwapTx,
} = lpaccount;

const index = require("../src/autotasks/harvest/index");
const { claimWithSafe, swapWithSafe, main } = index;

const safeHelpers = require("../src/common/safe");
const { getSafe, executeSafeTx } = safeHelpers;

const { addOwnerWithThreshold } = require("./utils");

const {
  LP_SAFE_ADDRESS,
  LP_ACCOUNT_ADDRESS,
  CRV_ADDRESS,
  CVX_ADDRESS,
  USDC_ADDRESS,
  SWAPS,
} = require("../src/common/constants");
const erc20Abi = require("../src/abis/ERC20.json");
const lpAccountAbi = require("../src/abis/LpAccountV2.json");

use(smock.matchers);
use(chaiAsPromised);

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

  afterEach(() => {
    sinon.restore();
  });

  before(async () => {
    [signer] = await ethers.getSigners();
    lpAccount = new ethers.Contract(LP_ACCOUNT_ADDRESS, lpAccountAbi, signer);
  });

  before(async () => {
    await addOwnerWithThreshold(signer.address);
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
        balances.every((balance) => balance > 0)
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

  describe("createClaimTx", () => {
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
      const crv = new ethers.Contract(CRV_ADDRESS, erc20Abi, safeSigner);
      const cvx = new ethers.Contract(CVX_ADDRESS, erc20Abi, safeSigner);

      const tx = await createClaimTx(safeSigner);

      // Expect non-zero change, because chai matcher cannot check for < or >
      await expect(safeSigner.sendTransaction(tx))
        .to.not.changeTokenBalance(crv, LP_ACCOUNT_ADDRESS, 0)
        .and.not.changeTokenBalance(cvx, LP_ACCOUNT_ADDRESS, 0);
    });
  });

  describe("getSwapAmountUsdValue", () => {
    it("should keep the same number decimals as the amount param", () => {
      const amount = 1000n;
      const tokenPrice = 1.0;
      const usdValue = getSwapAmountUsdValue(amount, tokenPrice);
      expect(usdValue).to.equal(amount);
    });

    it("should throw an error if amount is not a BigInt", () => {
      const amount = 1000.7;
      const tokenPrice = 1.0;
      expect(() => getSwapAmountUsdValue(amount, tokenPrice)).to.throw(
        TypeError
      );
    });

    it("should throw an error if tokenPrice is negative", () => {
      const amount = 1000n;
      const tokenPrice = -1.0;
      expect(() => getSwapAmountUsdValue(amount, tokenPrice)).to.throw(
        RangeError
      );
    });

    it("should correctly calculate USD value from amount and price", () => {
      const amount = 1000n;
      const tokenPrice = 2.3;
      const usdValue = getSwapAmountUsdValue(amount, tokenPrice);

      const expectedUsdValue = 2300n;
      expect(usdValue).to.equal(expectedUsdValue);
    });
  });

  describe("getSlippageUsdValue", () => {
    it("should throw an error if slippage is not a string", () => {
      const usdValue = 1000n;
      const slippage = 2;
      expect(() => getSlippageUsdValue(usdValue, slippage)).to.throw;
    });

    it("should keep the same number of decimals as the usdValue param", () => {
      const usdValue = 1000n;
      const slippage = "1.0";
      const slippageUsdValue = getSlippageUsdValue(usdValue, slippage);
      expect(slippageUsdValue).to.equal(usdValue);
    });

    it("should throw an error if slippage is negative", () => {
      const usdValue = 1000n;
      const slippage = "-1.0";
      expect(() => getSlippageUsdValue(usdValue, slippage)).to.throw(
        RangeError
      );
    });

    it("should correctly calculate USD value of slippage from the USD value of the swap amount", () => {
      const usdValue = 1000n;
      const slippage = "0.03";
      const slippageUsdValue = getSlippageUsdValue(usdValue, slippage);

      const expectedSlippageUsdValue = 30n;
      expect(slippageUsdValue).to.equal(expectedSlippageUsdValue);
    });
  });

  describe("getSwapMinAmount", () => {
    it("should throw an error if swap does not exist", async () => {
      const swap = "DoesNotExist";
      const amount = 1000n;
      await expect(getSwapMinAmount(swap, amount)).to.be.rejectedWith(
        TypeError
      );
    });

    Object.keys(SWAPS).forEach((swap) => {
      describe(swap, () => {
        beforeEach(() => {
          const tokenPrice = 1.1;

          sinon.replace(
            coingecko,
            "getTokenPrice",
            sinon.fake.resolves(tokenPrice)
          );
        });

        it("should throw an error if inTokenDecimals is negative", async () => {
          const amount = 1000n * 10n ** 18n;

          sinon.replace(SWAPS[swap], "inTokenDecimals", -2n);

          await expect(getSwapMinAmount(swap, amount)).to.be.rejectedWith(
            RangeError
          );
        });

        it("should throw an error if outTokenDecimals is negative", async () => {
          const amount = 1000n * 10n ** 18n;

          sinon.replace(SWAPS[swap], "outTokenDecimals", -2n);

          await expect(getSwapMinAmount(swap, amount)).to.be.rejectedWith(
            RangeError
          );
        });

        it("should throw an error if both inTokenDecimals and outTokenDecimals are negative", async () => {
          const amount = 1000n * 10n ** 18n;

          sinon.replace(SWAPS[swap], "inTokenDecimals", -2n);
          sinon.replace(SWAPS[swap], "outTokenDecimals", -2n);

          await expect(getSwapMinAmount(swap, amount)).to.be.rejectedWith(
            RangeError
          );
        });

        it("should throw an error if USD value of slippage is greater than the USD value of the swap amount", async () => {
          const amount = 1000n * 10n ** 18n;

          sinon.replace(SWAPS[swap], "slippage", "1.2");

          await expect(getSwapMinAmount(swap, amount)).to.be.rejectedWith(
            RangeError
          );
        });

        it("should return the minAmount using outTokenDecimals", async () => {
          const amount = 1000n * 10n ** 18n;

          sinon.restore();

          const tokenPrice = 1.0;
          sinon.replace(
            coingecko,
            "getTokenPrice",
            sinon.fake.resolves(tokenPrice)
          );

          const slippage = "0.0";
          sinon.replace(SWAPS[swap], "slippage", slippage);

          const decimals = 6n;
          sinon.replace(SWAPS[swap], "outTokenDecimals", decimals);

          const minAmount = await getSwapMinAmount(swap, amount);

          const expectedMinAmount = 1000n * 10n ** decimals;
          expect(minAmount).to.equal(expectedMinAmount);
        });

        it("should correctly calculate the minAmount for the swap", async () => {
          const amount = 1000n * 10n ** 18n;

          const slippage = "0.1";
          sinon.replace(SWAPS[swap], "slippage", slippage);

          const decimals = 6n;
          sinon.replace(SWAPS[swap], "outTokenDecimals", decimals);

          const minAmount = await getSwapMinAmount(swap, amount);

          const expectedMinAmount = 990n * 10n ** decimals;
          expect(minAmount).to.equal(expectedMinAmount);
        });
      });
    });
  });

  describe("createSwapTx", () => {
    let safeSigner;

    before(async () => {
      await impersonateAccount(LP_SAFE_ADDRESS);
      await setBalance(LP_SAFE_ADDRESS, 10n ** 18n);
      safeSigner = await ethers.getSigner(LP_SAFE_ADDRESS);
    });

    after(async () => {
      await stopImpersonatingAccount(LP_SAFE_ADDRESS);
    });

    Object.keys(SWAPS).forEach((swap) => {
      describe(swap, () => {
        beforeEach(() => {
          const minAmount = 100n * 10n ** SWAPS[swap].outTokenDecimals;
          sinon.replace(
            lpaccount,
            "getSwapMinAmount",
            sinon.fake.resolves(minAmount)
          );
        });

        describe("Before claims", () => {
          it("should throw an error if amount is less than 1", async () => {
            await expect(createSwapTx(safeSigner, swap)).to.be.rejected;
          });
        });

        describe("After claims", () => {
          beforeEach(async () => {
            const tx = await createClaimTx(safeSigner);
            await safeSigner.sendTransaction(tx);
          });

          it("should return a populated tx object", async () => {
            const tx = await createSwapTx(safeSigner, swap);
            expect(tx).to.include.all.keys("to", "data", "value");
          });

          it("should throw an error if minAmount is less than the threshold for executing a swap", async () => {
            sinon.restore();

            const minAmount = 100n;
            sinon.replace(
              lpaccount,
              "getSwapMinAmount",
              sinon.fake.resolves(minAmount)
            );

            await expect(createSwapTx(safeSigner, swap)).to.be.rejected;
          });

          it(`should swap ${swap}`, async () => {
            const token = new ethers.Contract(
              SWAPS[swap].address,
              erc20Abi,
              safeSigner
            );

            const usdc = new ethers.Contract(
              USDC_ADDRESS,
              erc20Abi,
              safeSigner
            );

            const balance = (
              await token.balanceOf(LP_ACCOUNT_ADDRESS)
            ).toBigInt();

            const tx = await createSwapTx(safeSigner, swap);

            await expect(safeSigner.sendTransaction(tx))
              .to.changeTokenBalance(token, LP_ACCOUNT_ADDRESS, -balance)
              .and.not.to.changeTokenBalance(usdc, LP_ACCOUNT_ADDRESS, 0);
          });
        });
      });
    });
  });

  describe("executeSafeTx", () => {
    it("should return a receipt when there is a tx response", async () => {
      const tx = { to: "0x0", data: "0x0" };

      const safeTx = { to: "0x0", data: "0x0" };
      const expectedReceipt = { txHash: "0x0" };
      const executedTx = {
        transactionResponse: { wait: () => Promise.resolve(expectedReceipt) },
      };
      const safe = {
        createTransaction: () => Promise.resolve(safeTx),
        signTransaction: () => Promise.resolve(safeTx),
        executeTransaction: () => Promise.resolve(executedTx),
      };

      const receipt = await executeSafeTx(tx, safe);

      expect(receipt).to.deep.equal(expectedReceipt);
    });

    it("should return undefined when there is no tx response", async () => {
      const tx = { to: "0x0", data: "0x0" };

      const safeTx = { to: "0x0", data: "0x0" };
      const executedTx = {};
      const safe = {
        createTransaction: () => Promise.resolve(safeTx),
        signTransaction: () => Promise.resolve(safeTx),
        executeTransaction: () => Promise.resolve(executedTx),
      };

      const receipt = await executeSafeTx(tx, safe);

      expect(receipt).to.equal(undefined);
    });
  });

  describe("swapWithSafe", async () => {
    it("should return an array of receipts for every swap if they all succeed", async () => {
      sinon.replace(lpaccount, "createSwapTx", () =>
        Promise.resolve({ to: "0x0", data: "0x0" })
      );

      const receipt = { txHash: "0x0" };
      sinon.replace(safeHelpers, "executeSafeTx", sinon.fake.resolves(receipt));

      const safe = sinon.fake();
      const receipts = await swapWithSafe(safe, signer);

      const expectedNumberOfReceipts = 2;
      expect(receipts).to.have.lengthOf(expectedNumberOfReceipts);
    });

    it("should execute all swaps that successfully create a tx and skip swaps that fail to have a tx created", async () => {
      const txs = {
        CRV: Promise.resolve({ to: "0x0", data: "0x0" }),
        CVX: Promise.reject(new Error()),
      };
      const createSwapTxFake = (signer, swap) => txs[swap];
      sinon.replace(lpaccount, "createSwapTx", createSwapTxFake);

      const receipt = { txHash: "0x0" };
      const executeSafeTxFake = sinon.replace(
        safeHelpers,
        "executeSafeTx",
        sinon.fake.resolves(receipt)
      );

      const safe = sinon.fake();
      const receipts = await swapWithSafe(safe, signer);

      const expectedCallCount = 1;
      expect(executeSafeTxFake.callCount).to.equal(expectedCallCount);
    });

    it("should return an empty array of receipts if no swap tx could be created", async () => {
      sinon.replace(lpaccount, "createSwapTx", () =>
        Promise.reject(new Error())
      );

      const receipt = { txHash: "0x0" };
      const executeSafeTxFake = sinon.replace(
        safeHelpers,
        "executeSafeTx",
        sinon.fake.resolves(receipt)
      );

      const safe = sinon.fake();
      const receipts = await swapWithSafe(safe, signer);

      const expectedNumberOfReceipts = 0;
      expect(receipts).to.have.lengthOf(expectedNumberOfReceipts);
    });
  });

  describe("main", () => {
    beforeEach(() => {
      const tokenPrices = {
        // Prices at pegged block #15311844
        [CRV_ADDRESS]: 1.27,
        [CVX_ADDRESS]: 6.89,
      };
      const getTokenPriceFake = (address) =>
        Promise.resolve(tokenPrices[address]);

      sinon.replace(coingecko, "getTokenPrice", getTokenPriceFake);
    });

    it("should return tx receipts for claim and swaps", async () => {
      const { claimReceipt, swapReceipts } = await main(signer);

      const expectedKeys = [
        "gasUsed",
        "blockHash",
        "transactionHash",
        "blockNumber",
      ];
      expect(claimReceipt).to.include.all.keys(...expectedKeys);
      expect(swapReceipts).to.satisfy((receipts) =>
        receipts.every((receipt) =>
          expectedKeys.every((key) => receipt.hasOwnProperty(key))
        )
      );
    });

    it("should have sufficient gas left", async () => {
      const { claimReceipt, swapReceipts } = await main(signer);
      const { gasUsed } = claimReceipt;
      const { gasLimit } = await ethers.provider.getTransaction(
        claimReceipt.transactionHash
      );
      const gasRemaining = gasLimit.sub(gasUsed);
      expect(gasRemaining).to.be.above(0);

      expect(swapReceipts).to.satisfy((receipts) => {
        return Promise.all(
          receipts.every(async (receipt) => {
            const { gasUsed } = receipt;
            const { gasLimit } = await ethers.provider.getTransaction(
              receipt.transactionHash
            );
            const gasRemaining = gasLimit.sub(gasUsed);

            return gasRemaining.gt(0);
          })
        );
      });
    });

    it("should execute the transaction from the safe owner", async () => {
      const { claimReceipt, swapReceipts } = await main(signer);
      expect(claimReceipt.from).to.equal(signer.address);
      expect(swapReceipts).to.satisfy((receipts) =>
        receipts.every((receipt) => receipt.from == signer.address)
      );
    });

    it("should call the `LpAccount` swap function for each swap", async () => {
      // Claim reward tokens before LpAccount is mocked
      const safe = await getSafe(signer);
      await claimWithSafe(safe, signer);

      const lpAccountFake = await smock.fake(lpAccountAbi, {
        address: lpAccount.address,
      });
      lpAccountFake.swap.returns();

      await main(signer);

      expect(lpAccountFake.swap).to.have.called;
    });

    // Test after the swap function because the smock fake does not get reset
    it("should call the `LpAccount` claim function", async () => {
      sinon.replace(index, "swapWithSafe", sinon.fake());

      const lpAccountFake = await smock.fake(lpAccountAbi, {
        address: lpAccount.address,
      });
      lpAccountFake.claim.returns();

      await main(signer);

      expect(lpAccountFake.claim).to.have.called;
    });

    it("should not repay the safe owner for gas", async () => {
      expect(await main(signer)).to.changeEtherBalance(signer, 0);
    });
  });
});

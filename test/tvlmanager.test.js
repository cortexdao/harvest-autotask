const { expect } = require("chai");

const { TvlManager } = require("../src/common/tvlmanager");

describe("TvlManager", () => {
  let signer;
  let tvlManager;

  before(async () => {
    [signer] = await ethers.getSigners();
  });

  before(() => {
    tvlManager = new TvlManager(signer);
  });

  describe("getNav", () => {
    it("should sum all positions to a single BigInt", () => {
      const positions = [{ value: 1000n }, { value: 2000n }, { value: 3000n }];
      const nav = tvlManager.getNav(positions);

      const expectedNav = 6000n;
      expect(nav).to.equal(expectedNav);
    });

    it("should return zero if passed an empty array", () => {
      const positions = [];
      const nav = tvlManager.getNav(positions);

      const expectedNav = 0n;
      expect(nav).to.equal(expectedNav);
    });
  });
});

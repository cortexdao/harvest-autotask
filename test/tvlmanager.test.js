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

  describe("getNav", () => {});
});

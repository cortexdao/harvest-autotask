const { expect, use } = require("chai");
const chaiAsPromised = require("chai-as-promised");
const sinon = require("sinon");
const coingecko = require("../src/common/coingecko");
const { main } = require("../src/autotasks/coingecko-depeg-sentinel/index");

use(chaiAsPromised);

describe("Coingecko Depeg Sentinel", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("main", () => {
    it("should return an empty array if the price is over the threshold", async () => {
      const price = 0.98;
      sinon.replace(coingecko, "getTokenPrice", () => Promise.resolve(price));

      const hash = "0x0";
      const payload = [{ hash }];

      const matches = await main(payload);

      expect(matches).to.be.empty;
    });

    it("should return an array of hashes if the price is under the threshold", async () => {
      const price = 0.7;
      sinon.replace(coingecko, "getTokenPrice", () => Promise.resolve(price));

      const hash = "0x0";
      const payload = [{ hash }];

      const matches = await main(payload);

      expect(matches).to.deep.include({ hash });
    });

    it("should throw an error if the coingecko API call fails", async () => {
      sinon.replace(coingecko, "getTokenPrice", () =>
        Promise.reject(new Error("Axios error"))
      );

      const hash = "0x0";
      const payload = [{ hash }];

      await expect(main(payload)).to.be.rejectedWith(Error);
    });

    it("should throw an error if the token price is negative", async () => {
      const price = -1.0;
      sinon.replace(coingecko, "getTokenPrice", () => Promise.resolve(price));

      const hash = "0x0";
      const payload = [{ hash }];

      await expect(main(payload)).to.be.rejectedWith(RangeError);
    });
  });
});

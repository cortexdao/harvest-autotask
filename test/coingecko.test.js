const { expect, use } = require("chai");
const chaiAsPromised = require("chai-as-promised");
const sinon = require("sinon");
const axios = require("axios");

const {
  DAI_ADDRESS,
  USDC_ADDRESS,
  USDT_ADDRESS,
} = require("../src/common/constants");

const { getTokenPrice } = require("../src/common/coingecko");

use(chaiAsPromised);

describe("Coingecko API", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("getTokenPrice", () => {
    it("should return a number when given a single token address", async () => {
      const expectedPrice = 1.0;
      const response = { data: { [USDC_ADDRESS]: { usd: expectedPrice } } };
      sinon.replace(axios, "get", () => Promise.resolve(response));

      const price = await getTokenPrice(USDC_ADDRESS);

      expect(price).to.equal(expectedPrice);
    });

    it("should return an array of numbers when given an array of token addresses", async () => {
      const expectedPrices = [1.0, 1.1, 1.2];
      const response = {
        data: {
          [DAI_ADDRESS]: { usd: expectedPrices[0] },
          [USDC_ADDRESS]: { usd: expectedPrices[1] },
          [USDT_ADDRESS]: { usd: expectedPrices[2] },
        },
      };
      sinon.replace(axios, "get", () => Promise.resolve(response));

      const addresses = [DAI_ADDRESS, USDC_ADDRESS, USDT_ADDRESS];
      const prices = await getTokenPrice(addresses);

      expect(prices).to.deep.equal(expectedPrices);
    });

    it("should return an array with a single number when given an array with one token address", async () => {
      const expectedPrices = [1.0];
      const response = {
        data: {
          [DAI_ADDRESS]: { usd: expectedPrices[0] },
        },
      };
      sinon.replace(axios, "get", () => Promise.resolve(response));

      const addresses = [DAI_ADDRESS];
      const prices = await getTokenPrice(addresses);

      expect(prices).to.deep.equal(expectedPrices);
    });
  });
});

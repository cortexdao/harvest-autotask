const axios = require("axios");
const axiosRetry = require("axios-retry");

const configureAxios = (axios) => {
  axiosRetry(axios, {
    retries: 3,
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
      return 500 <= error.response.status;
    },
  });
};

exports.getTokenPrice = async (address) => {
  const baseUrl = "https://api.coingecko.com/api/v3/";
  const path = "simple/token_price/ethereum";

  const quoteCurrency = "usd";
  const params = {
    contract_addresses: address,
    vs_currencies: quoteCurrency,
  };
  const response = await axios.get(baseUrl + path, { params });
  const price = response.data[address.toLowerCase()][quoteCurrency];

  return price;
};

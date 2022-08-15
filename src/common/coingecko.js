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

  const getResponse = async (contractAddresses) => {
    const params = {
      contract_addresses: contractAddresses,
      vs_currencies: quoteCurrency,
    };
    const response = await axios.get(baseUrl + path, { params });

    return response;
  };

  let price;
  if (Array.isArray(address)) {
    const response = await getResponse(address.join(","));
    price = Object.values(response.data).map((value) => value[quoteCurrency]);
  } else {
    const response = await getResponse(address);
    price = response.data[address][quoteCurrency];
  }

  return price;
};

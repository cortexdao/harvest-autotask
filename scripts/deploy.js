require("dotenv").config();

const { AutotaskClient } = require("defender-autotask-client");

const main = async () => {
  const {
    API_KEY: apiKey,
    API_SECRET: apiSecret,
    AUTOTASK_ID: autotaskId,
  } = process.env;
  const client = new AutotaskClient({ apiKey, apiSecret });

  await client.updateCodeFromFolder(autotaskId, "./src");
};

if (!module.parent) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.log(error);
      process.exit(1);
    });
} else {
  module.exports = main;
}

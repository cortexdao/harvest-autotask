require("dotenv").config();
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const argv = yargs(hideBin(process.argv))
  .command("autotask", "The autotask script name")
  .demandCommand().argv;

const path = require("path");

const { AutotaskClient } = require("defender-autotask-client");

const main = async (autotask) => {
  const {
    API_KEY: apiKey,
    API_SECRET: apiSecret,
    AUTOTASK_ID: autotaskId,
  } = process.env;
  const client = new AutotaskClient({ apiKey, apiSecret });

  const autotaskPath = path.join("src", "autotasks", autotask);

  try {
    await client.updateCodeFromFolder(autotaskId, autotaskPath);
  } catch {
    throw new Error(`Invalid autotask name: ${autotask}`);
  }
};

if (!module.parent) {
  main(argv._?.[0])
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

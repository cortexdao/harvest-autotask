require("dotenv").config();
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

const deployBuilder = (yargs) => {
  yargs
    .positional("autotask", {
      describe: "Autotask module name",
      type: "string",
    })
    .positional("id", {
      describe: "Autotask ID",
      type: "string",
      default: process.env.AUTOTASK_ID,
    });
};

const deployHandler = (argv) => {
  if (argv.id === undefined) {
    throw new Error(
      "Autotask ID must be specified in the CLI or in a $AUTOTASK_ID environment variable"
    );
  }
};

const argv = yargs(hideBin(process.argv))
  .command(
    "$0 <autotask> [id]",
    "Deploy an Autotask",
    deployBuilder,
    deployHandler
  )
  .demandCommand().argv;

const path = require("path");

const { AutotaskClient } = require("defender-autotask-client");

const main = async (argv) => {
  const { API_KEY: apiKey, API_SECRET: apiSecret } = process.env;

  const client = new AutotaskClient({ apiKey, apiSecret });

  const { autotask, id: autotaskId } = argv;

  const autotaskPath = path.join("build", "autotasks", autotask);

  try {
    await client.updateCodeFromFolder(autotaskId, autotaskPath);
  } catch {
    throw new Error(`Invalid autotask name: ${autotask}`);
  }
};

if (!module.parent) {
  main(argv)
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

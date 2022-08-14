import { readdirSync } from "fs";
import path from "path";
import commonjs from "@rollup/plugin-commonjs";

const autotaskSrcDir = path.join("src", "autotasks");
const autotaskInputDirs = readdirSync(autotaskSrcDir, {
  withFileTypes: true,
}).filter((d) => d.isDirectory());

const inputEntryPoint = "index.js";
const outputEntryPoint = "index";
const autotaskInput = Object.fromEntries(
  autotaskInputDirs.map((d) => [
    path.join(d.name, outputEntryPoint),
    path.join(autotaskSrcDir, d.name, inputEntryPoint),
  ])
);

const autotaskOutputDir = path.join("build", "autotasks");

export default {
  input: autotaskInput,
  output: { dir: autotaskOutputDir, format: "cjs", exports: "named" },
  plugins: [commonjs()],
  external: [
    "ethers",
    "defender-relay-client/lib/ethers",
    "@gnosis.pm/safe-core-sdk",
    "dotenv",
    "axios",
    "axios-retry",
  ],
};

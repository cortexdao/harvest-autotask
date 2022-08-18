import { readdirSync } from "fs";
import path from "path";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

const autotaskSrcDir = path.join("src", "autotasks");
const autotaskInputDirs = readdirSync(autotaskSrcDir, {
  withFileTypes: true,
}).filter((d) => d.isDirectory());

const inputEntryPoint = "index.ts";
const outputEntryPoint = "index";
const autotaskInputs = autotaskInputDirs.map((d) => {
  const outputPath = path.join(d.name, outputEntryPoint);
  const inputPath = path.join(autotaskSrcDir, d.name, inputEntryPoint);
  return {
    [outputPath]: inputPath,
  };
});

const autotaskOutputDir = path.join("build", "autotasks");

const configs = autotaskInputs.map((autotaskInput) => {
  return {
    input: autotaskInput,
    output: {
      dir: autotaskOutputDir,
      format: "cjs",
    },
    plugins: [
      commonjs(),
      json(),
      nodeResolve({ preferBuiltins: true }),
      typescript(),
    ],
    external: [
      "ethers",
      "defender-relay-client/lib/ethers",
      "dotenv",
      "axios",
      "axios-retry",
      "fs",
    ],
  };
});

export default configs;

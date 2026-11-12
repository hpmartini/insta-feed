const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"], // tsc writes compiled specs to lib/; run only the sources
  transform: {
    ...tsJestTransformCfg,
  },
};
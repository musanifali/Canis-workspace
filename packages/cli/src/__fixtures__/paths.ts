import { fileURLToPath } from "node:url";

/** Absolute path to a file under src/__fixtures__, resolved from this module. */
export function fixture(relative: string): string {
  return fileURLToPath(new URL(`./${relative}`, import.meta.url));
}

export const CONTRACTS = {
  baseline: fixture("contracts/case.baseline.mjs"),
  narrowed: fixture("contracts/case.narrowed.mjs"),
  widened: fixture("contracts/case.widened.mjs"),
  clean: fixture("contracts/case.clean.mjs"),
  smelly: fixture("contracts/case.smelly.mjs"),
  broken: fixture("contracts/case.broken.mjs"),
  empty: fixture("contracts/empty.mjs"),
  serverOk: fixture("contracts/orders.server-ok.mjs"),
  serverBroken: fixture("contracts/orders.server-broken.mjs"),
};

export const SPECS_DIR = fixture("specs");

#!/usr/bin/env node
/**
 * `canis` executable. Thin wrapper over run(): wires real stdio/env/cwd and
 * translates the returned exit code to process.exitCode.
 */
import { run, type CliIo } from "../cli.js";

const io: CliIo = {
  stdout: (line) => process.stdout.write(`${line}\n`),
  stderr: (line) => process.stderr.write(`${line}\n`),
  env: process.env,
  cwd: process.cwd(),
};

run(process.argv.slice(2), io)
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(
      `canis: unexpected error: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`,
    );
    process.exitCode = 2;
  });

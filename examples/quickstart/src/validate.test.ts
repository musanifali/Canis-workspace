// Step 5 — the gate. Everything that reaches the renderer passes this same
// check, so run it in YOUR CI too: a contract change that would break this
// workspace fails here (and `ticora contracts diff` tells you across all of
// your saved workspaces).
import { validateSpec } from "@ticora/core";
import { expect, test } from "vitest";
import { ticketContract } from "./contract";
import { ticketBoardSpec } from "./spec";

test("the ticket board builds under the ticket contract", () => {
  const result = validateSpec(ticketBoardSpec, {
    contracts: { ticket: ticketContract },
  });
  expect(result.verdict).toBe("BUILD");
});

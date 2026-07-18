import { validateSpec } from "@workspace-engine/core";
import { expect, test } from "vitest";
import { ticketContract, triageSpec } from "./components/workspace";

test("the triage spec builds under the ticket contract", () => {
  const result = validateSpec(triageSpec, {
    contracts: { ticket: ticketContract },
  });
  expect(result.verdict).toBe("BUILD");
});

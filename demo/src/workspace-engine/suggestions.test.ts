import { describe, expect, it } from "vitest";
import { caseContract } from "./case-contract";
import { deriveSuggestions, suggestionsFor } from "./suggestions";

const contracts = [caseContract];

describe("deriveSuggestions — chips from contract capabilities (card #46)", () => {
  const chips = deriveSuggestions(contracts);

  it("emits a chip for each capability kind the contract declares", () => {
    const prompts = chips.map((c) => c.prompt.toLowerCase());
    expect(prompts.some((p) => p.startsWith("list all cases"))).toBe(true); // list
    expect(prompts.some((p) => p.includes("grouped by"))).toBe(true); // group
    expect(prompts.some((p) => p.includes("sorted by"))).toBe(true); // sort
    expect(prompts.some((p) => p.includes("total") || p.includes("average"))).toBe(true); // agg
    expect(prompts.some((p) => p.includes("filterable view"))).toBe(true); // filter
  });

  it("only references capabilities the contract actually declares (correct by construction)", () => {
    const caps = caseContract.capabilities;
    // Prompts render humanized field names ("riskScore" → "risk score"), so
    // compare against the humanized capability sets.
    const humanize = (f: string) =>
      f.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
    const groupableH = [...caps.groupable].map(humanize);
    const sortableH = [...caps.sortable].map(humanize);

    const group = chips.find((c) => c.prompt.includes("grouped by"))!;
    expect(groupableH).toContain(group.prompt.split("grouped by ")[1]);
    const sort = chips.find((c) => c.prompt.includes("sorted by"))!;
    const sortField = sort.prompt.split("sorted by ")[1]!.split(",")[0]!.trim();
    expect(sortableH).toContain(sortField);
  });

  it("only builds a filterable chip on a string-kind field (FilterBar needs TEXT, #69)", () => {
    const filter = chips.find((c) => c.prompt.includes("filterable view"));
    expect(filter).toBeDefined();
    const field = filter!.prompt.split("search by ")[1]!.trim();
    // humanize is identity for single-word lowercase fields like "title"/"customer".
    expect(caseContract.fields[field]).toBe("string");
  });

  it("gives every chip a stable unique id and a source", () => {
    const ids = chips.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(chips.every((c) => c.source === "derived")).toBe(true);
  });
});

describe("suggestionsFor — curated + derived merge (card #46)", () => {
  const curated = {
    analyst: [{ label: "My queue", prompt: "High-risk cases due this week" }],
  };

  it("leads with the role's curated chips, then fills with derived", () => {
    const list = suggestionsFor(contracts, { role: "analyst", curated, max: 4 });
    expect(list[0]!.source).toBe("curated");
    expect(list[0]!.label).toBe("My queue");
    expect(list.slice(1).every((c) => c.source === "derived")).toBe(true);
  });

  it("caps at max", () => {
    expect(suggestionsFor(contracts, { role: "analyst", curated, max: 3 })).toHaveLength(3);
  });

  it("falls back to derived-only for an unknown role", () => {
    const list = suggestionsFor(contracts, { role: "nobody", curated, max: 5 });
    expect(list.every((c) => c.source === "derived")).toBe(true);
  });

  it("de-dupes a derived chip that a curated chip already asks for", () => {
    const dup = { analyst: [{ label: "Everything", prompt: "List all cases" }] };
    const list = suggestionsFor(contracts, { role: "analyst", curated: dup, max: 10 });
    const listAll = list.filter((c) => c.prompt.toLowerCase() === "list all cases");
    expect(listAll).toHaveLength(1);
    expect(listAll[0]!.source).toBe("curated");
  });
});

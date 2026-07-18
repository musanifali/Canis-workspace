import type { QuerySpec } from "@workspace-engine/core";
import { describe, expect, it, vi } from "vitest";
import { graphqlFetch } from "./graphql.js";
import { prismaFetch } from "./prisma.js";
import { restFetch } from "./rest.js";
import { supabaseFetch, type SupabaseLike, type SupabaseQuery } from "./supabase.js";

const query: QuerySpec = {
  filters: [
    { field: "priority", op: "eq", value: "urgent" },
    { field: "subject", op: "contains", value: "refund" },
  ],
  sort: [{ field: "ageHours", dir: "desc" }],
  limit: 25,
};

describe("restFetch", () => {
  it("maps eq filters + limit to query params and sends the auth header", async () => {
    const rows = [{ id: "t1" }];
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(rows)),
    );
    const result = await restFetch("https://api.example.com")({ query, auth: "tok" });
    expect(result).toEqual(rows);
    const [url, init] = spy.mock.calls[0]!;
    expect(String(url)).toBe(
      "https://api.example.com/tickets?priority=urgent&limit=25",
    );
    expect((init!.headers as Record<string, string>).authorization).toBe("Bearer tok");
    spy.mockRestore();
  });

  it("throws on a non-2xx response instead of rendering garbage", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("nope", { status: 503 }));
    await expect(
      restFetch("https://api.example.com")({ query, auth: "tok" }),
    ).rejects.toThrow("tickets API 503");
    spy.mockRestore();
  });
});

describe("graphqlFetch", () => {
  it("sends the fixed document with mapped variables and unwraps data", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { tickets: [{ id: "t1" }] } })),
    );
    const result = await graphqlFetch("https://gql.example.com")({ query, auth: "tok" });
    expect(result).toEqual([{ id: "t1" }]);
    const body = JSON.parse(String(spy.mock.calls[0]![1]!.body));
    expect(body.variables).toEqual({ priority: "urgent", limit: 25 });
    expect(body.query).toContain("query Tickets");
    spy.mockRestore();
  });

  it("surfaces GraphQL errors as thrown errors", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: "denied" }] })),
    );
    await expect(
      graphqlFetch("https://gql.example.com")({ query, auth: "tok" }),
    ).rejects.toThrow("denied");
    spy.mockRestore();
  });
});

describe("prismaFetch", () => {
  it("maps filters/sort/limit into findMany and scopes by auth", async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: "t1" }]);
    const result = await prismaFetch({ ticket: { findMany } })({
      query,
      auth: "org_9",
    });
    expect(result).toEqual([{ id: "t1" }]);
    expect(findMany).toHaveBeenCalledWith({
      where: { orgId: "org_9", priority: "urgent" },
      orderBy: [{ ageHours: "desc" }],
      take: 25,
    });
  });
});

describe("supabaseFetch", () => {
  it("builds eq/order/limit and returns data", async () => {
    const calls: unknown[][] = [];
    const builder: SupabaseQuery = {
      eq: (...args) => (calls.push(["eq", ...args]), builder),
      in: (...args) => (calls.push(["in", ...args]), builder),
      order: (...args) => (calls.push(["order", ...args]), builder),
      limit: (...args) => (calls.push(["limit", ...args]), builder),
      then: (resolve) => resolve({ data: [{ id: "t1" }], error: null }),
    };
    const client: SupabaseLike = {
      from: () => ({ select: () => builder }),
    };
    const result = await supabaseFetch(client)({ query, auth: "jwt" });
    expect(result).toEqual([{ id: "t1" }]);
    expect(calls).toEqual([
      ["eq", "priority", "urgent"],
      ["order", "ageHours", { ascending: false }],
      ["limit", 25],
    ]);
  });

  it("throws on a Supabase error payload", async () => {
    const builder: SupabaseQuery = {
      eq: () => builder,
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      then: (resolve) => resolve({ data: null, error: { message: "RLS denied" } }),
    };
    const client: SupabaseLike = { from: () => ({ select: () => builder }) };
    await expect(supabaseFetch(client)({ query, auth: "jwt" })).rejects.toThrow(
      "RLS denied",
    );
  });
});

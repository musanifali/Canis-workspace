// REST recipe — the simplest honest adapter: list endpoint + auth header.
// Push cheap narrowing (eq filters, limit) into query params when your API
// supports them; return everything else as-is. Over-returning is safe — the
// engine filters/sorts/groups client-side. Under-returning is not.
import type { QuerySpec } from "@workspace-engine/core";

export function restFetch(baseUrl: string) {
  return async ({ query, auth }: { query: QuerySpec; auth: unknown }) => {
    const url = new URL(`${baseUrl}/tickets`);
    for (const filter of query.filters) {
      // Only eq maps cleanly onto typical REST query params; the engine
      // re-applies every filter anyway, so skipping the rest is correct.
      if (filter.op === "eq") url.searchParams.set(filter.field, String(filter.value));
    }
    if (query.limit) url.searchParams.set("limit", String(query.limit));

    const response = await fetch(url, {
      headers: { authorization: `Bearer ${String(auth)}` },
    });
    if (!response.ok) throw new Error(`tickets API ${response.status}`);
    return (await response.json()) as unknown[];
  };
}

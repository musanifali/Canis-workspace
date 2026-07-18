// Supabase recipe — supabase-js query builder with the user's JWT so
// Postgres RLS applies to every row. Same rule as always: map what's cheap
// (eq/in, order, limit), let the engine do the rest.
import type { QuerySpec } from "@workspace-engine/core";

/** The slice of supabase-js the recipe touches — substitute your client. */
export interface SupabaseQuery {
  eq(column: string, value: unknown): SupabaseQuery;
  in(column: string, values: readonly unknown[]): SupabaseQuery;
  order(column: string, options: { ascending: boolean }): SupabaseQuery;
  limit(count: number): SupabaseQuery;
  then(
    onFulfilled: (result: { data: unknown[] | null; error: { message: string } | null }) => void,
  ): void;
}
export interface SupabaseLike {
  from(table: string): { select(columns: string): SupabaseQuery };
}

export function supabaseFetch(client: SupabaseLike) {
  return async ({ query }: { query: QuerySpec; auth: unknown }) => {
    // Create the client per-request with the end user's JWT
    // (createClient(url, anonKey, { global: { headers: { Authorization } } }))
    // so RLS scopes rows — `auth` never needs manual WHERE clauses here.
    let builder = client
      .from("tickets")
      .select("id,subject,priority,assignee,age_hours,opened");
    for (const filter of query.filters) {
      if (filter.op === "eq") builder = builder.eq(filter.field, filter.value);
      if (filter.op === "in") builder = builder.in(filter.field, filter.value);
    }
    for (const sort of query.sort) {
      builder = builder.order(sort.field, { ascending: sort.dir === "asc" });
    }
    builder = builder.limit(query.limit ?? 200);

    const { data, error } = await new Promise<{
      data: unknown[] | null;
      error: { message: string } | null;
    }>((resolve) => builder.then(resolve));
    if (error) throw new Error(error.message);
    return data ?? [];
  };
}

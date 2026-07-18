// GraphQL recipe — one fixed document, variables for the cheap narrowing.
// Keep the document static (persisted-query friendly); the engine handles
// whatever your schema can't express.
import type { QuerySpec } from "@workspace-engine/core";

const TICKETS_QUERY = /* GraphQL */ `
  query Tickets($priority: String, $limit: Int) {
    tickets(priority: $priority, limit: $limit) {
      id
      subject
      priority
      assignee
      ageHours
      opened
    }
  }
`;

export function graphqlFetch(endpoint: string) {
  return async ({ query, auth }: { query: QuerySpec; auth: unknown }) => {
    const priority = query.filters.find(
      (filter) => filter.field === "priority" && filter.op === "eq",
    );
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${String(auth)}`,
      },
      body: JSON.stringify({
        query: TICKETS_QUERY,
        variables: {
          priority: priority ? String(priority.value) : null,
          limit: query.limit ?? null,
        },
      }),
    });
    if (!response.ok) throw new Error(`GraphQL ${response.status}`);
    const payload = (await response.json()) as {
      data?: { tickets: unknown[] };
      errors?: { message: string }[];
    };
    if (payload.errors?.length) throw new Error(payload.errors[0]!.message);
    return payload.data?.tickets ?? [];
  };
}

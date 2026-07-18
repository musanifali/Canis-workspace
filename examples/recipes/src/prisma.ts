// Prisma recipe — runs on YOUR server (a route handler or RPC), never in the
// browser. Map eq/in filters and sort into the Prisma query; the engine
// re-checks everything, so partial mapping is always safe. The structural
// client type below is exactly the slice of PrismaClient the recipe touches —
// substitute your generated client.
import type { QuerySpec } from "@workspace-engine/core";

export interface TicketDelegate {
  findMany(args: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, "asc" | "desc">[];
    take?: number;
  }): Promise<unknown[]>;
}

export function prismaFetch(db: { ticket: TicketDelegate }) {
  return async ({ query, auth }: { query: QuerySpec; auth: unknown }) => {
    const where: Record<string, unknown> = {
      // Row-level tenancy comes from the END USER's auth, not from the query.
      orgId: String(auth),
    };
    for (const filter of query.filters) {
      if (filter.op === "eq") where[filter.field] = filter.value;
      if (filter.op === "in") where[filter.field] = { in: filter.value };
    }
    return await db.ticket.findMany({
      where,
      orderBy: query.sort.map((sort) => ({ [sort.field]: sort.dir })),
      take: query.limit ?? 200,
    });
  };
}

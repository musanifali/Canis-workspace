import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  compileToExecutor,
  type Binding,
  type Block,
  type EntityContract,
  type RefreshPolicy,
} from "@workspace-engine/core";
import { effectiveZone, resolveQueryDates } from "./resolve-dates";
import { BindingFetchError, toBindingFetchError } from "./errors";

export type BlockStatus = "loading" | "error" | "success";

/** Normalized per-block data state handed to block components and BlockHost. */
export interface BlockDataState {
  status: BlockStatus;
  /** Query result: rows, groups, or aggregate. Undefined while loading/static. */
  data: unknown;
  /** Set only when the block failed with no data to fall back on. */
  error: BindingFetchError | null;
  /** A background refetch is in flight (drives staleness indicators). */
  isFetching: boolean;
  dataUpdatedAt: number | null;
  refetch: () => void;
}

export interface UseBlockQueryParams {
  block: Block;
  binding: Binding;
  contract: EntityContract;
  /** End-user auth, passed UNCHANGED to the vendor fetch (ADR-4). */
  auth: unknown;
  /** Workspace timezone for relative-date resolution. */
  timeZone: string;
  /** Workspace refresh policy (spec.refresh). */
  refresh: RefreshPolicy;
}

/**
 * Execute one block's binding through React Query.
 *
 * The queryFn resolves relative dates against `new Date()` at execution — so
 * "this_month" reflects when the block runs, not when the spec was saved — then
 * invokes the contract's compiled executor (validate → bound → vendor fetch with
 * the end user's auth). Failures surface as a BindingFetchError scoped to this
 * block. Refresh policy maps to React Query: `interval` sets a refetch interval
 * and matching staleTime; `manual` never auto-refetches (only user `refetch`).
 */
export function useBlockQuery(params: UseBlockQueryParams): BlockDataState {
  const { block, binding, contract, auth, timeZone, refresh } = params;

  const executor = useMemo(() => compileToExecutor(contract), [contract]);
  const zone = effectiveZone(timeZone);
  const interval = refresh.mode === "interval" ? refresh.seconds * 1000 : false;

  const query = useQuery<unknown[], BindingFetchError>({
    queryKey: ["workspace-block", block.id, binding.entity, binding.query, zone],
    queryFn: async () => {
      try {
        // Resolution is inside the try: an invalid IANA zone throws a
        // RangeError, which A4 requires we surface as a TYPED executor error
        // (BindingFetchError), not a raw one.
        const resolved = resolveQueryDates(binding.query, {
          now: new Date(),
          timeZone: zone,
        });
        return await executor({ query: resolved, auth });
      } catch (cause) {
        throw toBindingFetchError(cause, block);
      }
    },
    refetchInterval: interval,
    staleTime: interval === false ? Infinity : interval,
    placeholderData: keepPreviousData,
  });

  const hasData = query.data !== undefined;
  const status: BlockStatus =
    query.isError && !hasData
      ? "error"
      : query.isPending && !hasData
        ? "loading"
        : "success";

  return {
    status,
    data: query.data,
    // Honors the doc contract: error is set only on terminal failure (no data
    // to fall back on), so `status === "error" ⟺ error !== null`. A refetch that
    // fails while stale data is shown keeps status "success" with error null;
    // surfacing that "stale + last refresh failed" state is card #17's job.
    error: status === "error" ? (query.error ?? null) : null,
    isFetching: query.isFetching,
    dataUpdatedAt: query.dataUpdatedAt || null,
    refetch: () => {
      void query.refetch();
    },
  };
}

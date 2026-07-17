"use client";

/**
 * Data-access wiring for the read path (ADR-4). In service mode the demo
 * uses the vendor's REAL backend: it exchanges the end-user key for a signed
 * session token and passes that token as `userToken` — WorkspaceProvider
 * threads it UNCHANGED into the remote contract's fetch, where the vendor
 * route checks it. Outside service mode (tests, cold clones) the in-memory
 * contract keeps everything local.
 */
import { useEffect, useMemo, useState } from "react";
import type { EntityContract } from "@workspace-engine/core";
import { caseContract, createRemoteCaseContract } from "./case-contract";
import { serviceModeConfig } from "./workspace-store";

export interface VendorDataAccess {
  contracts: readonly EntityContract[];
  /** Passed to WorkspaceProvider.userToken — the end user's credential. */
  userToken: unknown;
  /** False while the session token is still being minted (service mode). */
  ready: boolean;
}

export function useVendorDataAccess(userKey: string): VendorDataAccess {
  // Build-time constant (NEXT_PUBLIC_ inlining); memo keeps it referentially
  // stable for the effect below.
  const service = useMemo(serviceModeConfig, []);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!service || !userKey) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/vendor/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userKey }),
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { token: string };
        if (!cancelled) setToken(payload.token);
      } catch {
        // Stay not-ready; blocks keep their loading state.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userKey, service]);

  const remoteContracts = useMemo(
    () => [createRemoteCaseContract()],
    [],
  );

  if (!service) {
    return { contracts: [caseContract], userToken: { demo: true }, ready: true };
  }
  return {
    contracts: remoteContracts,
    userToken: token,
    ready: token !== null,
  };
}

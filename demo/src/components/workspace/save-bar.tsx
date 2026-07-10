"use client";

/**
 * Save bar for the creation surface (card #21). Lifts the live workspace from the
 * interactables snapshot and persists it, so a generated screen can be reloaded
 * later. An unliftable workspace (still composing, or invalid) fails fast with
 * the reason instead of saving a broken screen.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { useCurrentInteractablesSnapshot } from "@tambo-ai/react";
import { validationContext } from "@/workspace-engine/kit";
import { liftWorkspaceSpec, LiftError } from "@/workspace-engine/lift";
import { createLocalStorageWorkspaceStore } from "@/workspace-engine/workspace-store";

type Status =
  | { kind: "idle" }
  | { kind: "saved"; title: string }
  | { kind: "error"; message: string };

export function WorkspaceSaveBar() {
  const snapshot = useCurrentInteractablesSnapshot();
  const store = useMemo(() => createLocalStorageWorkspaceStore(), []);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [busy, setBusy] = useState(false);

  const onSave = async () => {
    setBusy(true);
    setStatus({ kind: "idle" });
    try {
      const spec = liftWorkspaceSpec(snapshot, validationContext);
      const record = await store.create(spec);
      setStatus({ kind: "saved", title: record.title });
    } catch (err) {
      const message =
        err instanceof LiftError
          ? err.message
          : "Couldn't save this workspace. Please try again.";
      setStatus({ kind: "error", message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 border-b border-black/10 px-4 py-2 text-sm">
      <button
        type="button"
        onClick={onSave}
        disabled={busy}
        data-testid="save-workspace"
        className="rounded-md border border-black/15 px-3 py-1 font-medium hover:bg-black/5 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save workspace"}
      </button>
      <Link href="/saved" className="text-black/60 underline-offset-2 hover:underline">
        Saved workspaces
      </Link>
      {status.kind === "saved" && (
        <span data-testid="save-ok" className="text-green-700">
          Saved “{status.title}”. <Link href="/saved" className="underline">Open</Link>
        </span>
      )}
      {status.kind === "error" && (
        <span data-testid="save-error" className="text-red-700">
          {status.message}
        </span>
      )}
    </div>
  );
}

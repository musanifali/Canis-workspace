import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  parseSpec,
  validateSpec,
  type Block,
  type BlockId,
  type Frame,
  type RefreshPolicy,
  type ValidationVerdict,
  type WorkspaceSpec,
} from "@workspace-engine/core";
import {
  useWorkspaceStore,
  useWorkspaceValidationContext,
} from "./context";
import type { WorkspaceRecord } from "./store";
import { WORKSPACE_LIST_KEY } from "./useWorkspaceList";
import { workspaceKey } from "./useWorkspace";

/** save() throws this when a validation context is present and the draft fails. */
export class WorkspaceEditorSaveError extends Error {
  constructor(readonly verdict: Exclude<ValidationVerdict, { verdict: "BUILD" }>) {
    super(`workspace draft is not valid (${verdict.verdict})`);
    this.name = "WorkspaceEditorSaveError";
  }
}

interface EditorState {
  draft: WorkspaceSpec;
  /** Last seeded/saved spec — the target for reset() and the dirty baseline. */
  baseline: WorkspaceSpec;
  dirty: boolean;
}

type EditorAction =
  | { type: "seed"; spec: WorkspaceSpec }
  | { type: "setTitle"; title: string }
  | { type: "setDescription"; description: string | undefined }
  | { type: "setRefresh"; refresh: RefreshPolicy }
  | { type: "addBlock"; block: Block }
  | { type: "updateBlock"; id: BlockId; patch: Partial<Omit<Block, "id">> }
  | { type: "moveBlock"; id: BlockId; frame: Frame }
  | { type: "removeBlock"; id: BlockId }
  | { type: "reset" };

function mapBlock(
  draft: WorkspaceSpec,
  id: BlockId,
  fn: (block: Block) => Block,
): WorkspaceSpec {
  return { ...draft, blocks: draft.blocks.map((b) => (b.id === id ? fn(b) : b)) };
}

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "seed":
      return { draft: action.spec, baseline: action.spec, dirty: false };
    case "reset":
      return { ...state, draft: state.baseline, dirty: false };
    case "setTitle":
      return { ...state, draft: { ...state.draft, title: action.title }, dirty: true };
    case "setDescription":
      return {
        ...state,
        draft: { ...state.draft, description: action.description },
        dirty: true,
      };
    case "setRefresh":
      return {
        ...state,
        draft: { ...state.draft, refresh: action.refresh },
        dirty: true,
      };
    case "addBlock":
      return {
        ...state,
        draft: { ...state.draft, blocks: [...state.draft.blocks, action.block] },
        dirty: true,
      };
    case "updateBlock":
      return {
        ...state,
        draft: mapBlock(state.draft, action.id, (b) => ({
          ...b,
          ...action.patch,
          id: b.id,
        })),
        dirty: true,
      };
    case "moveBlock":
      return {
        ...state,
        draft: mapBlock(state.draft, action.id, (b) => ({ ...b, frame: action.frame })),
        dirty: true,
      };
    case "removeBlock":
      return {
        ...state,
        draft: {
          ...state.draft,
          blocks: state.draft.blocks.filter((b) => b.id !== action.id),
        },
        dirty: true,
      };
  }
}

export interface WorkspaceEditorParams {
  /** Starting spec: a loaded workspace's spec, or createBlankSpec() for new. */
  initialSpec: WorkspaceSpec;
  /** Existing workspace id → update on save; omit → create a new one. */
  id?: string | undefined;
}

export interface WorkspaceEditor {
  draft: WorkspaceSpec;
  isDirty: boolean;
  setTitle: (title: string) => void;
  setDescription: (description: string | undefined) => void;
  setRefresh: (refresh: RefreshPolicy) => void;
  addBlock: (block: Block) => void;
  updateBlock: (id: BlockId, patch: Partial<Omit<Block, "id">>) => void;
  moveBlock: (id: BlockId, frame: Frame) => void;
  removeBlock: (id: BlockId) => void;
  /** Discard edits, back to the last seeded/saved spec. */
  reset: () => void;
  /** Run the policy validator against the draft; null if no validation context. */
  validate: () => ValidationVerdict | null;
  /** Persist the draft (validating first when a context is present). */
  save: () => Promise<WorkspaceRecord>;
  saving: boolean;
  saveError: Error | null;
}

/**
 * Headless editor for a workspace spec (the "edit" flow). Manages a local draft
 * with typed, immutable mutations; tracks dirty state; validates through core's
 * validateSpec on save; persists via the store and invalidates the list/detail
 * caches so other hooks refresh. Returns state + actions only — the vendor
 * builds the entire editing UI. Re-seeds when `initialSpec` changes while clean
 * (e.g. an async load resolves); a dirty draft is never clobbered.
 */
export function useWorkspaceEditor(
  params: WorkspaceEditorParams,
): WorkspaceEditor {
  const store = useWorkspaceStore();
  const validation = useWorkspaceValidationContext();
  const queryClient = useQueryClient();

  const [state, dispatch] = useReducer(
    reducer,
    params.initialSpec,
    (spec): EditorState => ({ draft: spec, baseline: spec, dirty: false }),
  );

  // Reseed when initialSpec changes by VALUE (not identity): consumers commonly
  // pass a freshly-built object each render, so keying on identity would loop
  // forever. A dirty draft is never clobbered by a reseed.
  const lastSeeded = useRef(JSON.stringify(params.initialSpec));
  useEffect(() => {
    const serialized = JSON.stringify(params.initialSpec);
    if (serialized !== lastSeeded.current) {
      lastSeeded.current = serialized;
      if (!state.dirty) dispatch({ type: "seed", spec: params.initialSpec });
    }
  }, [params.initialSpec, state.dirty]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | null>(null);

  const validate = useCallback(
    (): ValidationVerdict | null =>
      validation ? validateSpec(state.draft, validation) : null,
    [validation, state.draft],
  );

  const save = useCallback(async (): Promise<WorkspaceRecord> => {
    setSaving(true);
    setSaveError(null);
    try {
      let toPersist: WorkspaceSpec;
      if (validation) {
        const verdict = validateSpec(state.draft, validation);
        if (verdict.verdict !== "BUILD") {
          throw new WorkspaceEditorSaveError(verdict);
        }
        toPersist = verdict.spec;
      } else {
        // No contracts wired: still gate on shape so we never persist garbage.
        toPersist = parseSpec(state.draft);
      }

      const record = params.id
        ? await store.update(params.id, toPersist)
        : await store.create(toPersist);

      dispatch({ type: "seed", spec: record.spec });
      await queryClient.invalidateQueries({ queryKey: WORKSPACE_LIST_KEY });
      if (params.id) {
        await queryClient.invalidateQueries({ queryKey: workspaceKey(params.id) });
      }
      return record;
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      setSaveError(error);
      throw error;
    } finally {
      setSaving(false);
    }
  }, [state.draft, validation, store, queryClient, params.id]);

  return {
    draft: state.draft,
    isDirty: state.dirty,
    setTitle: useCallback((title) => dispatch({ type: "setTitle", title }), []),
    setDescription: useCallback(
      (description) => dispatch({ type: "setDescription", description }),
      [],
    ),
    setRefresh: useCallback(
      (refresh) => dispatch({ type: "setRefresh", refresh }),
      [],
    ),
    addBlock: useCallback((block) => dispatch({ type: "addBlock", block }), []),
    updateBlock: useCallback(
      (id, patch) => dispatch({ type: "updateBlock", id, patch }),
      [],
    ),
    moveBlock: useCallback(
      (id, frame) => dispatch({ type: "moveBlock", id, frame }),
      [],
    ),
    removeBlock: useCallback(
      (id) => dispatch({ type: "removeBlock", id }),
      [],
    ),
    reset: useCallback(() => dispatch({ type: "reset" }), []),
    validate,
    save,
    saving,
    saveError,
  };
}

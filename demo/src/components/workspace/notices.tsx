"use client";

/**
 * Clarify / reject product surfaces (card #23).
 *
 * The validator gate (gatePlan) returns structured CLARIFY (one question +
 * options) and REJECT (explanation + typed errors) verdicts. These render them
 * as real product surfaces instead of a gray line of text: a reject names the
 * capability the data model is missing and the supported alternatives; a clarify
 * asks the one question with pickable options. Neither ever partial-renders a
 * broken workspace — that's the whole point of gating before the renderer.
 *
 * Both are @tambo-free (kept out of GeneratedWorkspace's dependency surface):
 * interaction is a plain `onPick` / `onRefine` callback the host wires to the
 * chat, so the user answers without losing the conversation.
 */
import type { SpecValidationError } from "@workspace-engine/core";

/** Pull the supported alternatives the validator named across all errors. */
function supportedAlternatives(errors: readonly SpecValidationError[]): string[] {
  const all = errors.flatMap((e) =>
    "allowed" in e && Array.isArray(e.allowed) ? [...e.allowed] : [],
  );
  return Array.from(new Set(all)).slice(0, 12);
}

export function RejectNotice({
  explanation,
  errors,
  onRefine,
}: {
  explanation: string;
  errors: readonly SpecValidationError[];
  onRefine?: () => void;
}) {
  const alternatives = supportedAlternatives(errors);
  return (
    <div
      data-testid="reject-notice"
      role="alert"
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm"
    >
      <div className="font-medium text-amber-900">
        That isn’t something this data can answer
      </div>
      <p className="mt-1 whitespace-pre-line text-amber-800">{explanation}</p>

      {alternatives.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-medium text-amber-900">Supported instead:</div>
          <div className="mt-1 flex flex-wrap gap-1">
            {alternatives.map((a) => (
              <span
                key={a}
                className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-xs text-amber-800"
              >
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-amber-700">
        Adjust your request in the chat below — your conversation is kept, so just
        refine it.{" "}
        {onRefine && (
          <button
            type="button"
            onClick={onRefine}
            className="underline underline-offset-2 hover:text-amber-900"
          >
            Try a supported version
          </button>
        )}
      </p>
    </div>
  );
}

export function ClarifyNotice({
  question,
  options,
  onPick,
}: {
  question: string;
  options?: readonly string[];
  onPick?: (option: string) => void;
}) {
  return (
    <div
      data-testid="clarify-notice"
      role="status"
      className="rounded-lg border border-sky-300 bg-sky-50 p-4 text-sm"
    >
      <div className="font-medium text-sky-900">One quick question</div>
      <p className="mt-1 text-sky-800">{question}</p>

      {options && options.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5" data-testid="clarify-options">
          {options.map((o) =>
            onPick ? (
              <button
                key={o}
                type="button"
                onClick={() => onPick(o)}
                className="rounded-full border border-sky-300 bg-white px-2.5 py-1 text-xs text-sky-800 hover:bg-sky-100"
              >
                {o}
              </button>
            ) : (
              <span
                key={o}
                className="rounded-full border border-sky-300 bg-white px-2.5 py-1 text-xs text-sky-800"
              >
                {o}
              </span>
            ),
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-sky-700">
        {onPick ? "Pick one, or answer" : "Answer"} in the chat below — nothing is
        lost.
      </p>
    </div>
  );
}

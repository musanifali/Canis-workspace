"use client";

/**
 * The zero-signup playground (#101). Type a sentence → a validated workspace
 * renders. Or try a "⛔" prompt and watch the gate refuse it with a reason in
 * the contract's own terms — the attack is the demo. No auth, no signup.
 */
import { useState } from "react";
import { WorkspaceProvider, WorkspaceRenderer } from "@workspace-engine/react";
import { defaultBlocks } from "@workspace-engine/ui";
import type { WorkspaceSpec } from "@workspace-engine/core";
import { playgroundContract } from "@/lib/contract";
import { CANNED_PROMPTS } from "@/lib/canned";
import type { PlaygroundResult } from "@/lib/generate";

const SIGNUP_URL = "https://ticora-dashboard.vercel.app/signup";

export default function Playground(): React.ReactElement {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(p: string) {
    setPrompt(p);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: p }),
      });
      if (res.status === 429) {
        setError("You're going fast — give it a minute and try again.");
        return;
      }
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Something went wrong.");
        return;
      }
      setResult((await res.json()) as PlaygroundResult);
    } catch {
      setError("Couldn't reach the generator.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="pg">
      <header className="pg-head">
        <h1>Type a sentence. Get a validated workspace.</h1>
        <p>
          Your request becomes a contract-checked screen — and anything outside
          the data contract is refused with a reason, never a broken render.
        </p>
      </header>

      <form
        className="pg-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (prompt.trim() && !loading) void run(prompt.trim());
        }}
      >
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={500}
          placeholder="e.g. group the items by status with a KPI for total effort"
          aria-label="Describe a workspace"
        />
        <button type="submit" disabled={loading || !prompt.trim()}>
          {loading ? "Building…" : "Build it"}
        </button>
      </form>

      <div className="pg-suggest">
        <span>Try:</span>
        {CANNED_PROMPTS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={c.featured ? "pg-chip pg-chip-danger" : "pg-chip"}
            onClick={() => void run(c.prompt)}
            disabled={loading}
          >
            {c.label}
          </button>
        ))}
      </div>

      {error ? <p className="pg-error">{error}</p> : null}

      {result ? (
        <section className="pg-result">
          {result.verdict === "BUILD" ? (
            <div className="pg-build">
              <div className="pg-verdict pg-ok">✓ BUILD — validated & rendered</div>
              <WorkspaceProvider devMode contracts={[playgroundContract]} blocks={defaultBlocks}>
                <WorkspaceRenderer spec={result.spec as WorkspaceSpec} />
              </WorkspaceProvider>
            </div>
          ) : null}

          {result.verdict === "CLARIFY" ? (
            <div className="pg-clarify">
              <div className="pg-verdict pg-ask">? CLARIFY — one question first</div>
              <ul>
                {result.questions.map((q, i) => (
                  <li key={i}>{q.question}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.verdict === "REJECT" ? (
            <div className="pg-reject">
              <div className="pg-verdict pg-no">⛔ REJECT — the gate refused this</div>
              <p className="pg-reject-lead">
                The request asked for data the contract doesn’t expose. It’s
                refused <strong>before</strong> anything renders — with the
                reason, in the data model’s own terms:
              </p>
              <ul>
                {result.reasons.map((r, i) => (
                  <li key={i}>
                    <strong>{r.message}</strong>
                    <br />
                    <span className="pg-fix">{r.fix}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <footer className="pg-cta">
        <p>
          This runs on a shared demo contract. <strong>Get this for your own
          data</strong> — define a contract, and the same gate protects every
          workspace your users generate.
        </p>
        <a href={SIGNUP_URL} className="pg-cta-btn">
          Create your workspace →
        </a>
      </footer>
    </main>
  );
}

"use client";

/**
 * "Renders in your design language" — the proof (#113).
 *
 * ONE generated spec, ONE contract, ONE dataset, rendered twice: with our
 * default blocks, and with a partner's own component set. The spec is not
 * edited between them — only the component registry changes. That is the whole
 * claim, made visible.
 */
import { WorkspaceProvider, WorkspaceRenderer, defineBlock } from "@ticora/react";
import { defaultBlocks } from "@ticora/ui";
import type { WorkspaceSpec } from "@ticora/core";
import { CANNED_PROMPTS } from "@/lib/canned";
import { playgroundContract } from "@/lib/contract";
import { gate } from "@/lib/generate";
import { NwBoard, NwKpis, NwTable } from "@/lib/native-blocks";

// The partner's registry: their components, our block types.
const northwindBlocks = [
  defineBlock({ type: "CasesTable", accepts: { shape: "rows" }, component: NwTable }),
  defineBlock({ type: "GroupedBoard", accepts: { shape: "groups" }, component: NwBoard }),
  defineBlock({ type: "KpiCards", accepts: { shape: "aggregate" }, component: NwKpis }),
];

// The SAME generated spec both sides render — taken from the GATE's output,
// exactly like the live flow does. validateSpec normalizes a candidate (filling
// query defaults the executor relies on), so rendering the raw candidate would
// break both panels. Render what the gate blessed, never the draft.
const verdict = gate(CANNED_PROMPTS.find((c) => c.id === "build")!.spec);
const spec = (verdict.verdict === "BUILD" ? verdict.spec : null) as WorkspaceSpec;

export default function NativeProof(): React.ReactElement {
  return (
    <main className="pg">
      <header className="pg-head">
        <h1>The same workspace, in two design languages</h1>
        <p>
          One generated spec. One contract. One dataset. The <strong>only</strong>{" "}
          difference between these two panels is which components are
          registered — the spec is not edited between them.
        </p>
      </header>

      <div className="proof">
        <section className="proof-pane">
          <div className="proof-label">Our default blocks</div>
          <WorkspaceProvider devMode contracts={[playgroundContract]} blocks={defaultBlocks}>
            <WorkspaceRenderer spec={spec} />
          </WorkspaceProvider>
        </section>

        <section className="proof-pane proof-pane--nw">
          <div className="proof-label">
            “Northwind” — a partner’s own components
          </div>
          <WorkspaceProvider devMode contracts={[playgroundContract]} blocks={northwindBlocks}>
            <WorkspaceRenderer spec={spec} />
          </WorkspaceProvider>
        </section>
      </div>

      <footer className="pg-cta">
        <p>
          Your components, our spec and gate. A generated screen looks like the
          rest of your product — and still can’t show data your contract
          doesn’t expose.
        </p>
        <a className="pg-cta-btn" href="https://ticora-docs.vercel.app/guides/host-components">
          How to wire your components →
        </a>
      </footer>

      <p className="proof-note">
        “Northwind” is an invented product identity used to illustrate a second
        design language. It is not a real company and implies no partnership.
      </p>
    </main>
  );
}

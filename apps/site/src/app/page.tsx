import { Web } from "@/components/Web";
import { Reveal } from "@/components/Reveal";
import { Nav, Footer } from "@/components/Chrome";
import { Verdicts } from "@/components/Verdicts";
import { Threads } from "@/components/Threads";

const PLAYGROUND = "https://ticora-playground.vercel.app";
const DOCS = "https://ticora-docs.vercel.app";

export default function Home() {
  return (
    <>
      <Nav />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <header className="hero">
        <div className="hero-web" aria-hidden="true">
          <Web spokes={18} rings={8} animate />
        </div>
        <div className="wrap hero-inner">
          <p className="eyebrow">Generative UI, on a leash</p>
          <h1 className="display">
            One thread in.
            <br />
            <span className="gold">Structure out.</span>
          </h1>
          <p className="lede hero-lede">
            Your users describe the screen they want. Ticora turns that sentence
            into a workspace your data contract already allows — and refuses,
            with a reason, when it doesn&rsquo;t. Nothing half-valid ever renders.
          </p>
          <div className="hero-cta">
            <a className="btn btn-primary" href={PLAYGROUND}>
              Try it — no signup
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
            <a className="btn btn-ghost" href={`${DOCS}/quickstart`}>Read the quickstart</a>
          </div>
          <p className="small hero-install">
            <code>npm i @ticora/react</code> · Apache-2.0 · v0.3.1
          </p>
        </div>
      </header>

      {/* ── THE MECHANISM: sentence → spec → gate ───────────────────────── */}
      <section id="how">
        <div className="wrap">
          <Reveal>
            <p className="eyebrow">How it holds</p>
            <h2 className="h2 sec-title">
              A model that can only ever<br />emit one shape.
            </h2>
          </Reveal>
          <Threads />
        </div>
      </section>

      <div className="wrap"><div className="rule" /></div>

      {/* ── THE REFUSAL: the differentiator ─────────────────────────────── */}
      <section id="refusal">
        <div className="wrap split">
          <Reveal className="split-copy">
            <p className="eyebrow">The part nobody demos</p>
            <h2 className="h2">
              Watch it say<br /><span className="gold">no.</span>
            </h2>
            <p className="lede">
              Ask for a column your contract never declared and most tools
              hallucinate something plausible. Ticora refuses before a pixel
              renders — and tells the user why, in the vocabulary of your own
              data model.
            </p>
            <p className="lede">
              That&rsquo;s why our adversarial suite is a feature, not a footnote:
              <strong className="gold"> 55 attacks across 12 families, 100% caught</strong>,
              re-run on every commit through the same gate the render path uses.
            </p>
            <a className="btn btn-ghost" href={PLAYGROUND}>Try to break it →</a>
          </Reveal>
          <Reveal className="split-visual">
            <Verdicts />
          </Reveal>
        </div>
      </section>

      {/* ── YOUR COMPONENTS: full-bleed, not a card ─────────────────────── */}
      <section id="native" className="bleed">
        <div className="wrap">
          <Reveal>
            <p className="eyebrow">Renders as you, not as us</p>
            <h2 className="h2 sec-title">
              It uses <span className="gold">your</span> components.
            </h2>
            <p className="lede sec-lede">
              A generated screen that looks foreign gets rejected by your users.
              So we don&rsquo;t ship the pixels — you register the components you
              already have, and we supply the spec, the validation and the data
              binding.
            </p>
          </Reveal>
          <Reveal>
            <div className="code-slab">
              <div className="code-head">
                <span className="dot" /><span className="dot" /><span className="dot" />
                <span className="code-file">blocks.tsx</span>
              </div>
              <pre className="code"><code>{`defineBlock({
  type: "CasesTable",
  accepts: { shape: "rows" },
  component: `}<span className="gold">{`YourDataTable`}</span>{`,   // ← already in your app
});`}</code></pre>
            </div>
          </Reveal>
          <div className="native-facts">
            {[
              ["Six block types", "Swap one at a time — a partial swap is a normal state, not a migration."],
              ["Or invent your own", "defineBlockType teaches the validator a new block, gated exactly like a built-in."],
              ["No style bleed", "We ship no stylesheet. Nothing we render can restyle your app."],
            ].map(([t, d]) => (
              <Reveal key={t} className="fact">
                <h3 className="h3">{t}</h3>
                <p className="small">{d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST: a table, not a card grid ─────────────────────────────── */}
      <section id="trust">
        <div className="wrap">
          <Reveal>
            <p className="eyebrow">Verifiable, not aspirational</p>
            <h2 className="h2 sec-title">Every claim points at a mechanism.</h2>
          </Reveal>
          <Reveal>
            <table className="proof">
              <tbody>
                <tr>
                  <td className="proof-claim">Your customers&rsquo; rows never rest with us</td>
                  <td className="proof-how">The SDK fetches inside your app, with your end-user&rsquo;s auth passed through unchanged</td>
                </tr>
                <tr>
                  <td className="proof-claim">Tenant isolation</td>
                  <td className="proof-how">Postgres row-level security, proven by a 15-assertion cross-tenant probe — denied by the database, not by our code remembering</td>
                </tr>
                <tr>
                  <td className="proof-claim">Tamper-evident history</td>
                  <td className="proof-how"><code>REVOKE UPDATE, DELETE</code> — a revoked privilege, not an absent code path</td>
                </tr>
                <tr>
                  <td className="proof-claim">Anonymous telemetry</td>
                  <td className="proof-how">Off by default; the table has no tenant and no user columns, by construction</td>
                </tr>
              </tbody>
            </table>
          </Reveal>
          <Reveal>
            <p className="small trust-foot">
              We also publish what we <em>don&rsquo;t</em> have — no SOC 2, no third-party
              pentest, no SSO yet. <a className="gold" href={`${DOCS}/security`}>Read the security page →</a>
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── CLOSE ───────────────────────────────────────────────────────── */}
      <section className="close">
        <div className="close-web" aria-hidden="true"><Web spokes={22} rings={9} /></div>
        <div className="wrap close-inner">
          <Reveal>
            <h2 className="h2">Spin your first workspace<br />in ten minutes.</h2>
            <div className="hero-cta">
              <a className="btn btn-primary" href={`${DOCS}/quickstart`}>Start building</a>
              <a className="btn btn-ghost" href={PLAYGROUND}>Or just play with it</a>
            </div>
          </Reveal>
        </div>
      </section>

      <Footer />
    </>
  );
}

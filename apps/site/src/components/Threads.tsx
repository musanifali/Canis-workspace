/**
 * sentence → spec → gate → screen, as a single connected thread rather than a
 * row of cards. The connector is the point: it's one continuous path, like silk.
 */
const STEPS = [
  { n: "01", t: "A sentence", d: "Your user asks for the screen they want, in their own words." },
  { n: "02", t: "One shape", d: "The model's only output is a WorkspaceSpec — never SQL, never markup, never code." },
  { n: "03", t: "The gate", d: "That spec is checked against your data contract. BUILD, CLARIFY, or REJECT — before anything renders." },
  { n: "04", t: "Your screen", d: "A BUILD renders through your own components, bound to data fetched inside your app." },
];

export function Threads() {
  return (
    <ol className="threads">
      {STEPS.map((s, i) => (
        <li className="thread" key={s.n} style={{ ["--i" as string]: String(i) }}>
          <div className="thread-rail" aria-hidden="true">
            <span className="thread-node" />
          </div>
          <div className="thread-copy">
            <span className="thread-n">{s.n}</span>
            <h3 className="h3">{s.t}</h3>
            <p className="small">{s.d}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

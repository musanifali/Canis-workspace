import { Mark } from "./Web";

const DOCS = "https://ticora-docs.vercel.app";
const PLAYGROUND = "https://ticora-playground.vercel.app";

export function Nav() {
  return (
    <nav className="nav">
      <div className="wrap nav-inner">
        <a href="/" className="brand" aria-label="Ticora home">
          <Mark />
          <span>Ticora</span>
        </a>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#native">Your components</a>
          <a href={`${DOCS}/security`}>Security</a>
          <a href={DOCS}>Docs</a>
        </div>
        <a className="btn btn-primary nav-cta" href={PLAYGROUND}>Try it</a>
      </div>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer-inner">
        <div className="footer-brand">
          <a href="/" className="brand"><Mark size={22} /><span>Ticora</span></a>
          <p className="small">Generative UI that can only build what your contract allows.</p>
        </div>
        <nav className="footer-cols" aria-label="Footer">
          <div>
            <h3 className="footer-h">Product</h3>
            <a href={PLAYGROUND}>Playground</a>
            <a href={`${DOCS}/quickstart`}>Quickstart</a>
            <a href={`${DOCS}/reference/plans`}>Plans &amp; limits</a>
          </div>
          <div>
            <h3 className="footer-h">Developers</h3>
            <a href={DOCS}>Documentation</a>
            <a href={`${DOCS}/guides/host-components`}>Bring your own components</a>
            <a href="https://www.npmjs.com/org/ticora">npm</a>
          </div>
          <div>
            <h3 className="footer-h">Trust</h3>
            <a href={`${DOCS}/security`}>Security</a>
            <a href={`${DOCS}/legal/privacy`}>Privacy</a>
            <a href={`${DOCS}/legal/terms`}>Terms</a>
          </div>
        </nav>
      </div>
      <div className="wrap footer-base">
        <span className="small">© 2026 Ticora · Apache-2.0</span>
        <span className="small">Built on a validator, not a vibe.</span>
      </div>
    </footer>
  );
}

import Link from "next/link";
import { brand } from "@/lib/brand";

const valueProps = [
  {
    label: "Grounded",
    body: "Every field maps to a real data contract. The model can't invent a column that isn't there.",
  },
  {
    label: "Validated",
    body: "Specs are gated before a single pixel renders. Invalid or out-of-scope requests get a grounded refusal, not a guess.",
  },
  {
    label: "Native",
    body: "Save a generated workspace and reload it later — it's a first-class screen, not an export.",
  },
];

const entryPoints = [
  {
    href: "/create",
    title: "Create",
    body: "Describe a workspace in plain language and watch it stream in live.",
    cta: "Open Create",
  },
  {
    href: "/workspaces",
    title: "Workspaces",
    body: "Curated, hand-written specs rendered deterministically against the demo case contract.",
    cta: "Browse workspaces",
  },
  {
    href: "/sandbox",
    title: "Sandbox",
    body: "A live, data-backed workspace with zero config — no contracts, no network.",
    cta: "Open sandbox",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-6 sm:px-10">
        <span className="font-sentient text-xl tracking-tight text-foreground">
          {brand.name}
        </span>
        <Link
          href="/create"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:opacity-90"
        >
          Open Create
        </Link>
      </header>

      <section className="mx-auto max-w-[1440px] px-6 pb-20 pt-12 sm:px-10 sm:pb-28 sm:pt-20">
        <p className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Natural language workspaces
        </p>
        <h1 className="mt-4 max-w-3xl font-sentient text-4xl leading-[1.1] tracking-tight text-foreground sm:text-6xl">
          {brand.tagline}
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          {brand.description}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/create"
            className="rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:opacity-90"
          >
            Open Create
          </Link>
          <Link
            href="/workspaces"
            className="rounded-md border border-border bg-transparent px-5 py-3 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-card"
          >
            Browse workspaces
          </Link>
        </div>
      </section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto grid max-w-[1440px] gap-8 px-6 py-16 sm:grid-cols-3 sm:px-10 sm:py-20">
          {valueProps.map((item) => (
            <div key={item.label}>
              <p className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-primary">
                {item.label}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-foreground sm:text-base">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-6 py-16 sm:px-10 sm:py-20">
        <h2 className="font-sentient text-2xl text-foreground sm:text-3xl">
          Three ways in
        </h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {entryPoints.map((entry) => (
            <Link
              key={entry.href}
              href={entry.href}
              className="group flex flex-col rounded-lg border border-border bg-popover p-6 transition-colors duration-150 hover:border-primary"
            >
              <h3 className="text-base font-medium text-foreground">
                {entry.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {entry.body}
              </p>
              <span className="mt-4 text-sm font-medium text-primary">
                {entry.cta} →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <footer className="border-t border-border px-6 py-8 sm:px-10">
        <p className="font-mono text-xs text-muted-foreground">
          {brand.name} — built on Tambo.
        </p>
      </footer>
    </main>
  );
}

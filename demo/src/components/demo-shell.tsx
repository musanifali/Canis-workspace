"use client";

/**
 * Unified demo shell (Trello #77): a persistent slim top bar shared across the
 * live surfaces so they read as one product and are navigable in a live demo.
 *
 * Deliberately provider-agnostic — it renders *outside* any TamboProvider (the
 * /create route mounts its own). It owns the full-height flex frame; each page
 * fills the scrollable content area below the bar. Nav is real <Link>s (not
 * click-divs) with aria-current for keyboard + screen-reader users.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { brand } from "@/lib/brand";

const navItems = [
  { href: "/create", label: "Create" },
  { href: "/workspaces", label: "Workspaces" },
  { href: "/saved", label: "Saved" },
  { href: "/sandbox", label: "Sandbox" },
] as const;

export function DemoShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-6 border-b border-border px-6">
        <Link
          href="/"
          className="font-sentient text-lg tracking-tight text-foreground"
        >
          {brand.name}
        </Link>
        <nav
          className="flex items-center gap-1"
          aria-label="Primary"
        >
          {navItems.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

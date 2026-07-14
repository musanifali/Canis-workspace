import { DemoShell } from "@/components/demo-shell";

/**
 * Route-group layout (Trello #77): wraps the live surfaces — /create,
 * /workspaces, /saved, /sandbox — in the shared DemoShell. The landing page
 * (/) is outside this group and keeps its own header. Route groups don't
 * affect URLs, so paths are unchanged.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DemoShell>{children}</DemoShell>;
}

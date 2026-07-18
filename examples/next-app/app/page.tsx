// SERVER component. It can fetch server-side data (session, feature flags)
// and pass PLAIN, SERIALIZABLE props across the boundary — never contracts,
// blocks, or anything holding a function. Those are created client-side in
// components/workspace.tsx.
import { TicketWorkspace } from "../components/workspace";

export default function Page() {
  const userToken = "demo-user"; // in a real app: derive from the session
  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem" }}>
      <h1 style={{ fontSize: "1.25rem" }}>Canis — Next.js App Router example</h1>
      <TicketWorkspace userToken={userToken} />
    </main>
  );
}

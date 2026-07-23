/**
 * Welcome screen (#91 AC): the new tenant lands here with THEIR admin key,
 * shown exactly once, and the quickstart wired to it. The raw key rides a
 * single-use signed cookie set by the OAuth callback; "Continue" clears it.
 */
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";
import { unseal } from "@/lib/oauth-state";

export const metadata = { title: "Welcome — Canis" };

export default async function WelcomePage(): Promise<ReactElement> {
  const jar = await cookies();
  const result = unseal(jar.get("signup_result")?.value);
  if (!result) {
    // No handoff cookie — nothing to show. Send them to signup.
    redirect("/signup");
  }

  const apiBase = process.env.WORKSPACE_API_URL ?? "http://localhost:8270";
  const keyLine = result.apiKey
    ? result.apiKey
    : "(already issued — manage keys in the dashboard)";

  return (
    <section className="welcome">
      <h1>Welcome to {result.orgName} 🎉</h1>
      <p>
        Your tenant <code>{result.slug}</code> is live. Here’s your admin API
        key — <strong>copy it now, it won’t be shown again.</strong>
      </p>

      <pre className="welcome-key" aria-label="Your admin API key">
        {keyLine}
      </pre>

      <h2>Register your first contract</h2>
      <p>
        Point the CLI at your service and register a data contract — you’ll have
        a working workspace in under two minutes:
      </p>
      <pre className="welcome-snippet">
        {`curl -X PUT ${apiBase}/v1/contracts/case \\
  -H "x-api-key: ${result.apiKey || "<your-key>"}" \\
  -H "x-user-id: you" \\
  -H "content-type: application/json" \\
  -d '{"definition": { /* your entity contract */ }}'`}
      </pre>

      <p>
        Full walkthrough:{" "}
        <a href="https://docs.canis.dev/quickstart">the 10-minute quickstart</a>.
      </p>

      <form action="/api/signup/done" method="POST">
        <button type="submit" className="signup-submit">
          I’ve saved my key — continue to the dashboard
        </button>
      </form>
      <p className="welcome-skip">
        <Link href="/">Skip to dashboard</Link>
      </p>
    </section>
  );
}

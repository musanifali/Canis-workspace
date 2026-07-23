/**
 * Self-signup landing (#91): name your org, pick a handle, continue with
 * GitHub. The form POSTs to the OAuth start route, which stashes these fields
 * (signed cookie) and bounces to GitHub; the callback provisions the tenant.
 */
import type { ReactElement } from "react";

export const metadata = { title: "Sign up — Canis" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; slug?: string; org?: string }>;
}): Promise<ReactElement> {
  const { error, slug, org } = await searchParams;
  return (
    <section className="signup">
      <h1>Create your workspace</h1>
      <p className="signup-lead">
        Sign up with GitHub and get a provisioned tenant and API key in under a
        minute — no sales call, no waiting.
      </p>

      {error ? (
        <p className="signup-error" role="alert">
          {error}
        </p>
      ) : null}

      <form method="POST" action="/api/auth/github/start" className="signup-form">
        <label>
          Organization name
          <input
            name="orgName"
            required
            maxLength={80}
            defaultValue={org ?? ""}
            placeholder="Acme Inc"
          />
        </label>
        <label>
          Handle
          <input
            name="slug"
            required
            minLength={3}
            maxLength={40}
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            defaultValue={slug ?? ""}
            placeholder="acme"
          />
          <small>
            Lowercase letters, numbers, and hyphens. This is your public URL
            handle and can’t be changed later.
          </small>
        </label>
        <button type="submit" className="signup-submit">
          Continue with GitHub
        </button>
      </form>
    </section>
  );
}

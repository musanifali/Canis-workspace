/**
 * Login (#93). The only unauthenticated page. "Log in with GitHub" runs the
 * OAuth flow; the callback mints a server-side session and sets the cookie.
 */
import type { ReactElement } from "react";

export const metadata = { title: "Log in — Canis" };

const ERRORS: Record<string, string> = {
  not_configured: "GitHub sign-in isn’t configured yet.",
  csrf: "Sign-in expired or was tampered with. Try again.",
  github: "Couldn’t verify your GitHub account. Try again.",
  user_not_found: "No account for that GitHub identity. Sign up first.",
  not_a_member: "That account isn’t a member of this workspace.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}): Promise<ReactElement> {
  const { error } = await searchParams;
  const message = error ? (ERRORS[error] ?? "Sign-in failed. Try again.") : null;
  return (
    <section className="signup">
      <h1>Log in</h1>
      <p className="signup-lead">
        Sign in with the GitHub account you used to create your workspace.
      </p>
      {message ? (
        <p className="signup-error" role="alert">
          {message}
        </p>
      ) : null}
      <form method="GET" action="/api/auth/login/start">
        <button type="submit" className="signup-submit">
          Log in with GitHub
        </button>
      </form>
      <p className="welcome-skip">
        New here? <a href="/signup">Create a workspace</a>.
      </p>
    </section>
  );
}

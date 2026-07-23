"use client";

/** Revoke form with a native confirm before the destructive POST (#92). */
export function RevokeForm({ id }: { id: string }): React.ReactElement {
  return (
    <form
      method="POST"
      action="/api/keys/revoke"
      onSubmit={(e) => {
        if (!confirm("Revoke this key? Anything using it will stop working.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="key-revoke-btn">
        Revoke
      </button>
    </form>
  );
}

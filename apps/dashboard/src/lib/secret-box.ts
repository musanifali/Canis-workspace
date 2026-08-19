/**
 * Authenticated encryption for cookies that carry a live secret (#92 review).
 * The minted-key reveal cookie holds a real credential, so signing (which
 * leaves the value base64-readable) isn't enough — it must be ENCRYPTED.
 * AES-256-GCM gives confidentiality + integrity; the key is derived from
 * WORKSPACE_PROVISION_SECRET (already required server-side).
 */
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

function boxKey(): Buffer {
  const secret =
    process.env.WORKSPACE_PROVISION_SECRET ?? "dev-unencrypted-secret-box";
  return createHash("sha256").update(secret).digest(); // 32 bytes for AES-256
}

/** Encrypt an object → `iv.ciphertext.tag` (base64url). */
export function sealSecret(data: Record<string, string>): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", boxKey(), iv);
  const ct = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(data), "utf8")),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, ct, tag].map((b) => b.toString("base64url")).join(".");
}

/**
 * Decrypt a sealed value, or null if missing/tampered/undecryptable.
 * @returns The decoded object, or null.
 */
export function openSecret(
  value: string | undefined,
): Record<string, string> | null {
  if (!value) return null;
  const [ivB, ctB, tagB] = value.split(".");
  if (!ivB || !ctB || !tagB) return null;
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      boxKey(),
      Buffer.from(ivB, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagB, "base64url"));
    const pt = Buffer.concat([
      decipher.update(Buffer.from(ctB, "base64url")),
      decipher.final(),
    ]);
    return JSON.parse(pt.toString("utf8")) as Record<string, string>;
  } catch {
    return null; // wrong key, tampered tag, or malformed — treat as absent
  }
}

/**
 * Shared verification of the dashboard BFF's provisioning secret (#91, #93).
 * Both signup and the /v1/auth login surface trust the dashboard via this one
 * bootstrap secret: the dashboard verifies the GitHub identity, then calls the
 * service server-to-server. Fail-closed when the secret is unconfigured.
 */
import {
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Throw unless `provided` matches WORKSPACE_PROVISION_SECRET.
 * @throws ServiceUnavailableException when the secret is unset (fail-closed).
 * @throws UnauthorizedException when it's missing or wrong.
 */
export function verifyProvisionSecret(provided: string | undefined): void {
  const expected = process.env.WORKSPACE_PROVISION_SECRET;
  if (!expected) {
    throw new ServiceUnavailableException(
      "this endpoint is not configured (WORKSPACE_PROVISION_SECRET unset)",
    );
  }
  if (!provided || !secretMatches(provided, expected)) {
    throw new UnauthorizedException("invalid provisioning secret");
  }
}

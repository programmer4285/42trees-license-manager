import type { LicenseError, LicenseVerifier } from "../application/license-verifier";
import { ok, type Result } from "../shared/result";

export function newNoopLicenseVerifier(
  result: Result<void, LicenseError> = ok(undefined),
): LicenseVerifier {
  return {
    async verify() {
      return result;
    },
  };
}

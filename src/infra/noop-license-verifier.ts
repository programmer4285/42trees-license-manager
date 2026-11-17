import { LicenseVerifier } from "../application/license-verifier";

export function newNoopLicenseVerifier(verified = true): LicenseVerifier {
  return {
    async verify() {
      return verified;
    },
  };
}

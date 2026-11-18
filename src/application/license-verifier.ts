import type { Result } from "../shared/result";

export type VerifyLicenseRequest = {
  licenseKey: string;
  productId: string;
};

export type LicenseError =
  | { kind: "LicenseNotFound" }
  | { kind: "LicenseRefunded" }
  | { kind: "LicenseDisputed" }
  | { kind: "UpstreamUnavailable"; cause: unknown };

export interface LicenseVerifier {
  verify(req: VerifyLicenseRequest): Promise<Result<void, LicenseError>>;
}

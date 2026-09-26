export type VerifyLicenseRequest = {
  licenseKey: string;
  productId: string;
};

export interface LicenseVerifier {
  verify(req: VerifyLicenseRequest): Promise<boolean>;
}

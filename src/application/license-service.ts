import { LicenseVerifier } from "./license-verifier";
import { TokenService } from "./token-service";
import { LicenseRepo } from "../domain/license-repo";
import { newSeat } from "../domain/seat";
import { createHash } from "node:crypto";

export type ActivateCommand = {
  licenseKey: string;
  productId: string;
  deviceId: string;
};

export function newLicenseService(
  repo: LicenseRepo,
  licenseVerifier: LicenseVerifier,
  tokenService: TokenService,
) {
  return {
    async activate(cmd: ActivateCommand): Promise<string> {
      const verified = await licenseVerifier.verify({
        licenseKey: cmd.licenseKey,
        productId: cmd.productId,
      });

      // TODO: throw error if verified = false

      const licenseHash = createHash("sha256")
        .update(cmd.licenseKey)
        .digest("hex");

      const seat = newSeat({
        productId: cmd.productId,
        deviceId: cmd.deviceId,
        licenseHash,
      });

      await repo.insertSeat(seat);

      return tokenService.issueToken({
        productId: cmd.productId,
        deviceId: cmd.deviceId,
      });
    },
  };
}

export type LicenseService = ReturnType<typeof newLicenseService>;

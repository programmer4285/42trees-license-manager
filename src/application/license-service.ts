import { LicenseError, LicenseVerifier } from "./license-verifier";
import { ok, type Result } from "../shared/result";
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
    async activate(cmd: ActivateCommand): Promise<Result<string, LicenseError>> {
      const result = await licenseVerifier.verify({
        licenseKey: cmd.licenseKey,
        productId: cmd.productId,
      });
      if (!result.ok) {
        return result;
      }

      const licenseHash = createHash("sha256").update(cmd.licenseKey).digest("hex");

      const seat = newSeat({
        productId: cmd.productId,
        deviceId: cmd.deviceId,
        licenseHash,
      });

      await repo.upsertSeat(seat);

      const token = await tokenService.issueToken({
        productId: cmd.productId,
        deviceId: cmd.deviceId,
      });

      return ok(token);
    },
  };
}

export type LicenseService = ReturnType<typeof newLicenseService>;

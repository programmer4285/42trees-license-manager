import { LicenseError, LicenseVerifier } from "./license-verifier";
import { err, ok, type Result } from "../shared/result";
import { TokenService } from "./token-service";
import { LicenseRepo } from "../domain/license-repo";
import { newSeat } from "../domain/seat";
import { createHash } from "node:crypto";

export type ActivateCommand = {
  licenseKey: string;
  productId: string;
  deviceId: string;
};

export type ActivateError = LicenseError | { kind: "SeatLimitReached" };

export type Activation = { token: string; seat: "created" | "refreshed" };

export type LicenseServiceOptions = { seatLimit: number };

export function newLicenseService(
  repo: LicenseRepo,
  licenseVerifier: LicenseVerifier,
  tokenService: TokenService,
  opts: LicenseServiceOptions,
) {
  return {
    async activate(cmd: ActivateCommand): Promise<Result<Activation, ActivateError>> {
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

      const seatClaim = await repo.claimSeat(seat, opts.seatLimit);
      if (seatClaim === "unavailable") {
        return err({ kind: "SeatLimitReached" });
      }

      const token = await tokenService.issueToken({
        productId: cmd.productId,
        deviceId: cmd.deviceId,
      });

      return ok({ token, seat: seatClaim });
    },
  };
}

export type LicenseService = ReturnType<typeof newLicenseService>;

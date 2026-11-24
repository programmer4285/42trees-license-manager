import ky, { isHTTPError } from "ky";
import type { LicenseVerifier } from "../application/license-verifier";
import { err, ok } from "../shared/result";

export type GumroadResponse =
  | {
      success: true;
      purchase: { refunded: boolean; disputed: boolean; dispute_won: boolean };
    }
  | { success: false; message: string };

export type GumroadLicenseVerifierOptions = {
  // inject fetch for testability purposes
  fetch?: typeof fetch;
};

export function newGumroadLicenseVerifier(
  opts: GumroadLicenseVerifierOptions = {},
): LicenseVerifier {
  const gumroad = ky.extend({
    prefix: "https://api.gumroad.com/v2",
    fetch: opts.fetch,
  });

  return {
    async verify(req) {
      try {
        const res = await gumroad
          .post("/licenses/verify", {
            searchParams: {
              product_id: req.productId,
              license_key: req.licenseKey,
              increment_uses_count: false,
            },
          })
          .json<GumroadResponse>();

        if (!res.success) {
          return err({ kind: "LicenseNotFound" });
        }

        if (res.purchase.refunded) {
          return err({ kind: "LicenseRefunded" });
        }

        if (res.purchase.disputed && !res.purchase.dispute_won) {
          return err({ kind: "LicenseDisputed" });
        }

        return ok(undefined);
      } catch (cause) {
        // Gumroad answers an unknown license with 404 { success: false }.
        if (isHTTPError(cause) && cause.response.status === 404) {
          return err({ kind: "LicenseNotFound" });
        }

        return err({ kind: "UpstreamUnavailable", cause });
      }
    },
  };
}

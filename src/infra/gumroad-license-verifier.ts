import ky from "ky";
import { LicenseVerifier } from "../application/license-verifier";

export type GumroadResponse =
  | {
      success: true;
      purchase: { refunded: boolean; disputed: boolean; dispute_won: boolean };
    }
  | { success: false; message: string };

export function newGumroadLicenseVerifier(): LicenseVerifier {
  const gumroad = ky.extend({
    prefix: "https://api.gumroad.com/v2",
  });

  return {
    async verify(req) {
      try {
        const res = await gumroad
          .post("/licenses/verify", {
            searchParams: {
              product_id: req.productId,
              license_key: req.licenseKey,
            },
          })
          .json<GumroadResponse>();

        // TODO: check refunded/disputed

        return res.success;
      } catch (err) {
        // TODO: handle error
        throw err;
      }
    },
  };
}

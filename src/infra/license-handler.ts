import { Context } from "hono";
import z from "zod";
import { LicenseService } from "../application/license-service";
import { TokenService } from "../application/token-service";

const activateRequestSchema = z.object({
  licenseKey: z.string(),
  productId: z.string(),
  deviceId: z.uuid(),
});

export function newLicenseHandler(
  licenseService: LicenseService,
  tokenService: TokenService,
) {
  return {
    async activate(c: Context) {
      const body = await c.req.json();
      // TODO: handle errors
      const parsed = activateRequestSchema.parse(body);

      const token = await licenseService.activate(parsed);

      return c.json({ token }, 200);
    },

    async getPublicKeys(c: Context) {
      c.header("Cache-Control", "public, max-age=300");

      const keys = tokenService.getPublicKeys();

      return c.json({ keys });
    },
  };
}

export type LicenseHandler = ReturnType<typeof newLicenseHandler>;

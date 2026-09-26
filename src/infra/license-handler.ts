import { Context } from "hono";
import z from "zod";
import { LicenseService } from "../application/license-service";

const activateRequestSchema = z.object({
  licenseKey: z.string(),
  productId: z.string(),
  deviceId: z.uuid(),
});

export function newLicenseHandler(service: LicenseService) {
  return {
    async activate(c: Context) {
      const body = await c.req.json();
      // TODO: handle errors
      const parsed = activateRequestSchema.parse(body);

      await service.activate(parsed);

      c.status(204);
    },
  };
}

export type LicenseHandler = ReturnType<typeof newLicenseHandler>;

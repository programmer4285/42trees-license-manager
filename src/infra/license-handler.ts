import { Context } from "hono";
import z from "zod";
import { LicenseService } from "../application/license-service";
import { LicenseError } from "../application/license-verifier";
import { TokenService } from "../application/token-service";

const activateRequestSchema = z.object({
  licenseKey: z.string(),
  productId: z.string(),
  deviceId: z.uuid(),
});

type ActivateError = LicenseError | { kind: "InvalidRequest" };

function errorResponse(c: Context, error: ActivateError): Response {
  switch (error.kind) {
    case "InvalidRequest":
      return c.json({ error: error.kind }, 400);
    case "LicenseNotFound":
      return c.json({ error: error.kind }, 404);
    case "LicenseRefunded":
    case "LicenseDisputed":
      return c.json({ error: error.kind }, 403);
    case "UpstreamUnavailable":
      console.error("license provider unavailable", error.cause);
      return c.json({ error: error.kind }, 503);
  }
}

export function newLicenseHandler(licenseService: LicenseService, tokenService: TokenService) {
  return {
    async activate(c: Context) {
      const body: unknown = await c.req.json().catch(() => undefined);
      const parsed = activateRequestSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(c, { kind: "InvalidRequest" });
      }

      const result = await licenseService.activate(parsed.data);
      if (!result.ok) {
        return errorResponse(c, result.error);
      }

      return c.json({ token: result.value }, 200);
    },

    async getPublicKeys(c: Context) {
      c.header("Cache-Control", "public, max-age=300");

      const keys = tokenService.getPublicKeys();

      return c.json({ keys });
    },
  };
}

export type LicenseHandler = ReturnType<typeof newLicenseHandler>;

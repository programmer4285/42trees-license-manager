import { Context } from "hono";
import z from "zod";
import { LicenseService } from "../application/license-service";
import { LicenseError } from "../application/license-verifier";
import { TokenService } from "../application/token-service";
import { getErrorFields, type WideEventEnv } from "./wide-event";

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
      return c.json({ error: error.kind }, 503);
  }
}

export function newLicenseHandler(licenseService: LicenseService, tokenService: TokenService) {
  return {
    async activate<E extends WideEventEnv>(c: Context<E>) {
      const event = c.var.event;

      // the body may not be valid json
      const body: unknown = await c.req.json().catch(() => undefined);
      const parsed = activateRequestSchema.safeParse(body);
      if (!parsed.success) {
        event.outcome = "InvalidRequest";
        return errorResponse(c, { kind: "InvalidRequest" });
      }

      event.productId = parsed.data.productId;
      event.deviceId = parsed.data.deviceId;

      const result = await licenseService.activate(parsed.data);
      if (!result.ok) {
        event.outcome = result.error.kind;

        if (result.error.kind === "UpstreamUnavailable") {
          event.error = getErrorFields(result.error.cause);
        }

        return errorResponse(c, result.error);
      }

      event.outcome = "LicenseActivated";

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

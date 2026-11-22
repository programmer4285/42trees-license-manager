import { Hono, Context } from "hono";
import z from "zod";
import { LicenseHandler, newLicenseHandler } from "./infra/license-handler";
import { newGumroadLicenseVerifier } from "./infra/gumroad-license-verifier";
import { newD1LicenseRepo } from "./infra/d1-license-repo";
import { newHonoTokenService } from "./infra/hono-token-service";
import { newLicenseService } from "./application/license-service";
import { consoleLogger, wideEventMiddleware, type WideEventEnv } from "./infra/wide-event";
import { rateLimitMiddleware } from "./infra/rate-limit";

type AppEnv = { Bindings: CloudflareBindings } & WideEventEnv;

const app = new Hono<AppEnv>();

app.use(wideEventMiddleware(consoleLogger));

const configSchema = z.object({
  JWT_PRIVATE_KEY: z.string().min(1),
  TOKEN_ISSUER: z.string().min(1),
  TOKEN_TTL_SECONDS: z.coerce.number().int().positive(),
  SEAT_LIMIT: z.coerce.number().int().positive(),
});

function initApp(c: Context<AppEnv>): LicenseHandler {
  const config = configSchema.parse(c.env);

  const tokenService = newHonoTokenService({
    jwk: config.JWT_PRIVATE_KEY,
    issuer: config.TOKEN_ISSUER,
    ttlSeconds: config.TOKEN_TTL_SECONDS,
  });

  const repo = newD1LicenseRepo(c.env.DB);
  const verifier = newGumroadLicenseVerifier();
  const licenseService = newLicenseService(repo, verifier, tokenService, {
    seatLimit: config.SEAT_LIMIT,
  });

  return newLicenseHandler(licenseService, tokenService);
}

app.post("/v1/activate", rateLimitMiddleware(), async (c) => {
  const handler = initApp(c);

  return handler.activate(c);
});

app.get("/v1/jwks", (c) => {
  const handler = initApp(c);

  return handler.getPublicKeys(c);
});

app.onError((_, c) => {
  return c.json({ error: "Internal Server Error" }, 500);
});

export default app;

import { Hono, Context } from "hono";
import { LicenseHandler, newLicenseHandler } from "./infra/license-handler";
import { newGumroadLicenseVerifier } from "./infra/gumroad-license-verifier";
import { newD1LicenseRepo } from "./infra/d1-license-repo";
import { newHonoTokenService } from "./infra/hono-token-service";
import { newLicenseService } from "./application/license-service";

const app = new Hono<{ Bindings: CloudflareBindings }>();

function initApp(c: Context<{ Bindings: CloudflareBindings }>): LicenseHandler {
  const jwk = c.env.JWT_PRIVATE_KEY;
  const issuer = c.env.TOKEN_ISSUER;
  const ttlSeconds = Number(c.env.TOKEN_TTL_SECONDS);

  const tokenService = newHonoTokenService({
    jwk,
    issuer,
    ttlSeconds,
  });

  const repo = newD1LicenseRepo(c.env.DB);
  const verifier = newGumroadLicenseVerifier();
  const licenseService = newLicenseService(repo, verifier, tokenService);

  return newLicenseHandler(licenseService, tokenService);
}

app.post("/v1/activate", async (c) => {
  const handler = initApp(c);

  return handler.activate(c);
});

app.get("/v1/jwks", (c) => {
  const handler = initApp(c);

  return handler.getPublicKeys(c);
});

export default app;

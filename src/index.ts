import { Hono, Context } from "hono";
import { LicenseHandler, newLicenseHandler } from "./infra/license-handler";
import { newGumroadLicenseVerifier } from "./infra/gumroad-license-verifier";
import { newD1LicenseRepo } from "./infra/d1-license-repo";
import { newHonoTokenService } from "./infra/hono-token-service";
import { newLicenseService } from "./application/license-service";
import { assert } from "es-toolkit";

const TTL_SECONDS = 2592000; // 30 days

const app = new Hono<{ Bindings: CloudflareBindings }>();

function initApp(c: Context<{ Bindings: CloudflareBindings }>): LicenseHandler {
  const privateJwk = c.env.JWT_PRIVATE_KEY;

  assert(
    privateJwk !== undefined,
    "JWT_PRIVATE_KEY is undefined, this is almost certainly a bug.",
  );

  const tokenService = newHonoTokenService({
    privateJwk,
    issuer: "42trees",
    ttlSeconds: TTL_SECONDS,
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

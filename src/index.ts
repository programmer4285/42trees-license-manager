import { Hono, Context } from "hono";
import { LicenseHandler, newLicenseHandler } from "./infra/license-handler";
import { newGumroadLicenseVerifier } from "./infra/gumroad-license-verifier";
import { newD1LicenseRepo } from "./infra/d1-license-repo";
import { newLicenseService } from "./application/license-service";

const app = new Hono<{ Bindings: CloudflareBindings }>();

function initApp(c: Context<{ Bindings: CloudflareBindings }>): LicenseHandler {
  const repo = newD1LicenseRepo(c.env.DB);
  const verifier = newGumroadLicenseVerifier();
  const service = newLicenseService(repo, verifier);
  return newLicenseHandler(service);
}

app.post("/v1/activate", async (c) => {
  const handler = initApp(c);

  return handler.activate(c);
});

export default app;

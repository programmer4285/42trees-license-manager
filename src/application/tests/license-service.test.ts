import { describe, expect, it } from "vitest";
import { decode, verify } from "hono/jwt";
import { newLicenseService } from "../license-service";
import { newHonoTokenService } from "../../infra/hono-token-service";
import { newInMemoryLicenseRepo } from "../../infra/inmemory-license-repo";
import { newNoopLicenseVerifier } from "../../infra/noop-license-verifier";
import { err } from "../../shared/result";
import { assert } from "es-toolkit";
import { generateKey } from "../../test-utils/helpers";

const ISS = "unittest";

describe("license activation", () => {
  it("records a seat and returns a token that verifies against the published keys", async () => {
    expect.assertions(7);

    const kid = "kid-test";
    const productId = crypto.randomUUID();
    const deviceId = crypto.randomUUID();
    const licenseKey = crypto.randomUUID();

    const licenseRepo = newInMemoryLicenseRepo();
    const licenseVerifier = newNoopLicenseVerifier();
    const tokenService = newHonoTokenService({
      jwk: await generateKey(kid),
      issuer: ISS,
      ttlSeconds: 2592000,
    });

    const service = newLicenseService(licenseRepo, licenseVerifier, tokenService);

    const result = await service.activate({
      licenseKey,
      productId,
      deviceId,
    });

    assert(result.ok, `activation failed: ${result}`);

    const { token } = result.value;

    expect(licenseRepo.seats).toHaveLength(1);
    expect(licenseRepo.seats[0]).toMatchObject({
      productId,
      deviceId,
    });

    const { header } = decode(token);
    expect(header).toEqual({ alg: "EdDSA", typ: "JWT", kid });

    const publicJwk = tokenService.getPublicKeys().find((k) => k.kid === header.kid);
    assert(publicJwk, "no published key matches the token's kid");
    const payload = await verify(token, publicJwk, {
      alg: "EdDSA",
      iss: ISS,
    });

    expect(payload).toMatchObject({
      iss: ISS,
      sub: deviceId,
      product_id: productId,
    });
    const { iat, exp } = payload;
    assert(iat !== undefined && exp !== undefined, "token is missing iat or exp");
    expect(exp - iat).toBe(2592000);

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain(licenseKey);
    expect(serialized).not.toContain(licenseRepo.seats[0].licenseHash);
  });

  it("returns the verifier's rejection and records no seat", async () => {
    const licenseRepo = newInMemoryLicenseRepo();
    const service = newLicenseService(
      licenseRepo,
      newNoopLicenseVerifier(err({ kind: "LicenseRefunded" })),
      newHonoTokenService({ jwk: await generateKey("kid"), issuer: ISS, ttlSeconds: 60 }),
    );

    const result = await service.activate({
      licenseKey: crypto.randomUUID(),
      productId: crypto.randomUUID(),
      deviceId: crypto.randomUUID(),
    });

    expect(result).toEqual({ ok: false, error: { kind: "LicenseRefunded" } });
    expect(licenseRepo.seats).toHaveLength(0);
  });
});

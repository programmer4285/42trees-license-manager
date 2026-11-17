import { describe, expect, it } from "vitest";
import { decode, verify } from "hono/jwt";
import { newLicenseService } from "../license-service";
import { newHonoTokenService } from "../../infra/hono-token-service";
import { newInMemoryLicenseRepo } from "../../infra/inmemory-license-repo";
import { newNoopLicenseVerifier } from "../../infra/noop-license-verifier";

const ISS = "unittest";

async function generateKey(kid: string): Promise<string> {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  return JSON.stringify({
    kty: jwk.kty,
    crv: jwk.crv,
    x: jwk.x,
    d: jwk.d,
    kid,
  });
}

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

    const token = await service.activate({
      licenseKey,
      productId,
      deviceId,
    });

    expect(licenseRepo.seats).toHaveLength(1);
    expect(licenseRepo.seats[0]).toMatchObject({
      productId,
      deviceId,
    });

    const { header } = decode(token);
    expect(header).toEqual({ alg: "EdDSA", typ: "JWT", kid });

    const publicJwk = tokenService.getPublicKeys().find((k) => k.kid === header.kid)!;
    const payload = await verify(token, publicJwk, {
      alg: "EdDSA",
      iss: ISS,
    });

    expect(payload).toMatchObject({
      iss: ISS,
      sub: deviceId,
      product_id: productId,
    });
    expect(payload.exp! - payload.iat!).toBe(2592000);

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain(licenseKey);
    expect(serialized).not.toContain(licenseRepo.seats[0].licenseHash);
  });
});

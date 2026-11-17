import { describe, expect, it } from "vitest";
import { decode, verify } from "hono/jwt";
import { newLicenseService } from "../license-service";
import { newHonoTokenService } from "../../infra/hono-token-service";
import { newInMemoryLicenseRepo } from "../../infra/inmemory-license-repo";
import { newNoopLicenseVerifier } from "../../infra/noop-license-verifier";

async function generateKey(kid: string): Promise<string> {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey(
    "jwk",
    pair.privateKey,
  )) as JsonWebKey;
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
    const licenseRepo = newInMemoryLicenseRepo();

    const licenseVerifier = newNoopLicenseVerifier();

    const tokenService = newHonoTokenService({
      jwk: await generateKey("kid-activate"),
      issuer: "license-manager",
      ttlSeconds: 2592000,
    });

    const service = newLicenseService(
      licenseRepo,
      licenseVerifier,
      tokenService,
    );

    const token = await service.activate({
      licenseKey: "LICENSE-KEY-123",
      productId: "prod-1",
      deviceId: "6f1c2a4e-8b3d-4c5a-9e7f-1a2b3c4d5e6f",
    });

    expect(licenseRepo.seats).toHaveLength(1);
    expect(licenseRepo.seats[0]).toMatchObject({
      productId: "prod-1",
      deviceId: "6f1c2a4e-8b3d-4c5a-9e7f-1a2b3c4d5e6f",
    });

    const { header } = decode(token);
    expect(header).toEqual({ alg: "EdDSA", typ: "JWT", kid: "kid-activate" });

    const publicJwk = tokenService
      .getPublicKeys()
      .find((k) => k.kid === header.kid)!;
    const payload = await verify(token, publicJwk, {
      alg: "EdDSA",
      iss: "license-manager",
    });

    expect(payload).toMatchObject({
      iss: "license-manager",
      sub: "6f1c2a4e-8b3d-4c5a-9e7f-1a2b3c4d5e6f",
      product_id: "prod-1",
    });
    expect(payload.exp! - payload.iat!).toBe(2592000);

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("LICENSE-KEY-123");
    expect(serialized).not.toContain(licenseRepo.seats[0].licenseHash);
  });
});

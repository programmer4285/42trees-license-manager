import { describe, expect, it } from "vitest";
import { decode, verify } from "hono/jwt";
import { newHonoTokenService } from "../hono-token-service";

const TEST_PRIVATE_KEY = JSON.stringify({
  kty: "OKP",
  crv: "Ed25519",
  x: "UJz6M4ezR4Li3t8_0nmvmPV-dIMjW6QnPf5acERCuQg",
  d: "to4DVYnM6DHrLHnOYRKVXDrIvKJFittBEXz_lhppfM4",
  kid: "0FMmCKuln2bjoTtXzvBMhY4cUgkcW8tKZqXXjBsAtIc",
});

async function generateKey(kid = "test-kid"): Promise<string> {
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

function b64url(value: unknown): string {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const claims = { productId: "prod-1", deviceId: "device-1" };

describe("newHonoTokenService", () => {
  it("signs with an EdDSA header whose kid matches the published key", async () => {
    const service = newHonoTokenService({
      jwk: await generateKey("kid-123"),
      issuer: "license-manager",
      ttlSeconds: 60,
    });

    const { header } = decode(await service.issueToken(claims));

    expect(header).toEqual({ alg: "EdDSA", typ: "JWT", kid: "kid-123" });
    expect(service.getPublicKeys()[0].kid).toBe("kid-123");
  });

  it("issues exactly the expected claims", async () => {
    const service = newHonoTokenService({
      jwk: await generateKey(),
      issuer: "license-manager",
      ttlSeconds: 3600,
      now: () => new Date("2026-01-01T00:00:00Z"),
      newId: () => "jti-1",
    });

    const { payload } = decode(await service.issueToken(claims));

    expect(payload).toEqual({
      iss: "license-manager",
      sub: "device-1",
      product_id: "prod-1",
      iat: 1767225600,
      exp: 1767225600 + 3600,
      jti: "jti-1",
    });
  });

  it("sets exp to iat plus the configured lifetime", async () => {
    const service = newHonoTokenService({
      jwk: await generateKey(),
      issuer: "license-manager",
      ttlSeconds: 2592000,
    });

    const { payload } = decode(await service.issueToken(claims));

    expect(payload.exp! - payload.iat!).toBe(2592000);
  });

  it("issues a distinct jti per token", async () => {
    const service = newHonoTokenService({
      jwk: await generateKey(),
      issuer: "license-manager",
      ttlSeconds: 60,
    });

    const a = decode(await service.issueToken(claims)).payload;
    const b = decode(await service.issueToken(claims)).payload;

    expect(a.jti).not.toBe(b.jti);
  });

  it("produces tokens that verify with the published public key", async () => {
    const service = newHonoTokenService({
      jwk: await generateKey(),
      issuer: "license-manager",
      ttlSeconds: 60,
    });
    const [publicJwk] = service.getPublicKeys();

    const payload = await verify(await service.issueToken(claims), publicJwk, {
      alg: "EdDSA",
      iss: "license-manager",
    });

    expect(payload.sub).toBe("device-1");
  });

  it("rejects a token whose payload was tampered with", async () => {
    const service = newHonoTokenService({
      jwk: await generateKey(),
      issuer: "license-manager",
      ttlSeconds: 60,
    });
    const [publicJwk] = service.getPublicKeys();
    const token = await service.issueToken(claims);
    const [header, , signature] = token.split(".");
    const forged = b64url({ ...decode(token).payload, sub: "device-2" });

    await expect(
      verify(`${header}.${forged}.${signature}`, publicJwk, "EdDSA"),
    ).rejects.toThrow();
  });

  it("publishes only public key material", async () => {
    const service = newHonoTokenService({
      jwk: await generateKey("kid-123"),
      issuer: "license-manager",
      ttlSeconds: 60,
    });

    const keys = service.getPublicKeys();

    expect(keys).toHaveLength(1);
    expect(keys[0]).not.toHaveProperty("d");
    expect(keys[0]).toMatchObject({
      kty: "OKP",
      crv: "Ed25519",
      kid: "kid-123",
      alg: "EdDSA",
      use: "sig",
    });
  });

  it("signs and verifies with a key from scripts/generate-jwt-key.sh", async () => {
    const service = newHonoTokenService({
      jwk: TEST_PRIVATE_KEY,
      issuer: "license-manager",
      ttlSeconds: 60,
    });
    const [publicJwk] = service.getPublicKeys();
    const token = await service.issueToken(claims);

    expect(decode(token).header.kid).toBe(
      "0FMmCKuln2bjoTtXzvBMhY4cUgkcW8tKZqXXjBsAtIc",
    );
    await expect(verify(token, publicJwk, "EdDSA")).resolves.toBeDefined();
  });

  it.each([
    ["empty", ""],
    ["malformed JSON", "{not json"],
    [
      "an RSA key",
      JSON.stringify({ kty: "RSA", n: "abc", e: "AQAB", d: "x", kid: "k" }),
    ],
    [
      "an X25519 key",
      JSON.stringify({ kty: "OKP", crv: "X25519", x: "a", d: "b", kid: "k" }),
    ],
    [
      "a public-only key",
      JSON.stringify({ kty: "OKP", crv: "Ed25519", x: "a", kid: "k" }),
    ],
    [
      "a key without kid",
      JSON.stringify({ kty: "OKP", crv: "Ed25519", x: "a", d: "b" }),
    ],
    [
      "a key with a non-EdDSA alg",
      JSON.stringify({
        kty: "OKP",
        crv: "Ed25519",
        x: "a",
        d: "b",
        kid: "k",
        alg: "RS256",
      }),
    ],
  ])("refuses to construct with %s", (_, jwk) => {
    expect(() =>
      newHonoTokenService({ jwk, issuer: "i", ttlSeconds: 60 }),
    ).toThrow(/private JWK is invalid/);
  });

  it("does not echo key material when the key is invalid", () => {
    const secret = "super-secret-d-value";
    const jwk = JSON.stringify({
      kty: "OKP",
      crv: "X25519",
      x: "a",
      d: secret,
      kid: "k",
    });

    expect(() =>
      newHonoTokenService({ jwk, issuer: "i", ttlSeconds: 60 }),
    ).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining(secret) }),
    );
  });
});

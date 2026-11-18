// Returns a fresh Ed25519 private JWK as a JSON string, the format of the
// JWT_PRIVATE_KEY secret.
export async function generateKey(kid = "test-kid"): Promise<string> {
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

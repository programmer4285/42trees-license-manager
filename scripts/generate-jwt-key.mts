// Generates an Ed25519 key pair for signing license JWTs (EdDSA).
// The kid is the RFC 7638 thumbprint.

const { privateKey } = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
  "sign",
  "verify",
])) as CryptoKeyPair;
const { x, d } = (await crypto.subtle.exportKey("jwk", privateKey)) as JsonWebKey;

// RFC 7638: required members only, in lexicographic order, no whitespace.
const thumbprintInput = JSON.stringify({ crv: "Ed25519", kty: "OKP", x });
const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(thumbprintInput));
const kid = Buffer.from(digest).toString("base64url");

console.log(JSON.stringify({ kty: "OKP", crv: "Ed25519", x, d, kid }));

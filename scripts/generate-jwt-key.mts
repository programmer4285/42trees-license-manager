// Generates an Ed25519 key pair for signing license JWTs (EdDSA).
// Prints the private JWK (store as the JWT_PRIVATE_KEY secret) and the
// public JWK (embed in client apps). The kid is the RFC 7638 thumbprint.

const { privateKey } = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
  "sign",
  "verify",
])) as CryptoKeyPair;
const { x, d } = (await crypto.subtle.exportKey("jwk", privateKey)) as JsonWebKey;

// RFC 7638: required members only, in lexicographic order, no whitespace.
const thumbprintInput = JSON.stringify({ crv: "Ed25519", kty: "OKP", x });
const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(thumbprintInput));
const kid = new Uint8Array(digest).toBase64({ alphabet: "base64url", omitPadding: true });

console.log("# Private JWK (JWT_PRIVATE_KEY secret):");
console.log(JSON.stringify({ kty: "OKP", crv: "Ed25519", x, d, kid }));
console.log();
console.log("# Public JWK (embed in clients):");
console.log(JSON.stringify({ kty: "OKP", crv: "Ed25519", x, kid, alg: "EdDSA", use: "sig" }));

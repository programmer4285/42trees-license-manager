export type TokenClaims = {
  productId: string;
  deviceId: string;
};

export type PublicJwk = {
  // key type (octet key pair)
  kty: "OKP";

  // the OKP curve the key is on
  crv: "Ed25519";

  // the key itself. 32 bytes, b64 encoded.
  x: string;

  // the key id
  kid: string;

  // the JWS algorithm used to verify the key
  alg: "EdDSA";

  // sig indicates the key is for verification
  use: "sig";
};

export interface TokenService {
  issueToken(claims: TokenClaims): Promise<string>;
  getPublicKeys(): PublicJwk[];
}

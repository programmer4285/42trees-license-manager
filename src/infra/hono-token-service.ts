import { sign } from "hono/jwt";
import z from "zod";
import {
  PublicJwk,
  TokenClaims,
  TokenService,
} from "../application/token-service";

const jwkSchema = z.preprocess(
  (val: string) => {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  },
  z.object({
    kty: z.literal("OKP"),
    crv: z.literal("Ed25519"),
    // the public key
    x: z.string().min(1),
    // the private key
    d: z.string().min(1),
    kid: z.string().min(1),

    // alg must be present for hono/jwt to write the kid into the header
    alg: z.literal("EdDSA").default("EdDSA"),
  }),
);

export type HonoTokenServiceOptions = {
  jwk: string;
  issuer: string;
  ttlSeconds: number;

  // inject time and id generation functions as dependencies
  now?: () => Date;
  newId?: () => string;
};

export function newHonoTokenService(
  opts: HonoTokenServiceOptions,
): TokenService {
  const parsed = jwkSchema.safeParse(opts.jwk);
  if (!parsed.success) {
    // TODO: standardize error format
    throw new Error("private JWK is invalid, this is almost certainly a bug");
  }

  const jwk = parsed.data;

  const now = opts.now ?? (() => new Date());
  const newId = opts.newId ?? (() => crypto.randomUUID());

  const publicJwk: PublicJwk = {
    kty: jwk.kty,
    crv: jwk.crv,
    x: jwk.x,
    kid: jwk.kid,
    alg: "EdDSA",
    use: "sig",
  };

  return {
    async issueToken(claims: TokenClaims): Promise<string> {
      const iat = Math.floor(now().getTime() / 1000);

      return sign(
        {
          iss: opts.issuer,
          sub: claims.deviceId,
          product_id: claims.productId,
          iat,
          exp: iat + opts.ttlSeconds,
          jti: newId(),
        },
        jwk,
      );
    },

    getPublicKeys() {
      return [publicJwk];
    },
  };
}

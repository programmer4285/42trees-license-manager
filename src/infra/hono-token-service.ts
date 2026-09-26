import { sign } from "hono/jwt";
import z from "zod";
import {
  PublicJwk,
  TokenClaims,
  TokenService,
} from "../application/token-service";

const privateJwkSchema = z.preprocess(
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
    x: z.string().min(1),
    d: z.string().min(1),
    kid: z.string().min(1),

    // alg must be present for hono/jwt to write the kid into the header
    alg: z.literal("EdDSA").default("EdDSA"),
  }),
);

export type HonoTokenServiceOptions = {
  privateJwk: string;
  issuer: string;
  ttlSeconds: number;

  // inject time and id generation functions as dependencies
  now?: () => Date;
  newId?: () => string;
};

export function newHonoTokenService(
  opts: HonoTokenServiceOptions,
): TokenService {
  const parsed = privateJwkSchema.safeParse(opts.privateJwk);
  if (!parsed.success) {
    // TODO: standardize error format
    throw new Error("private JWK is invalid, this is almost certainly a bug");
  }

  const privateJwk = parsed.data;

  const now = opts.now ?? (() => new Date());
  const newId = opts.newId ?? (() => crypto.randomUUID());

  const publicJwk: PublicJwk = {
    kty: privateJwk.kty,
    crv: privateJwk.crv,
    x: privateJwk.x,
    kid: privateJwk.kid,
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
        privateJwk,
      );
    },

    getPublicKeys() {
      return [publicJwk];
    },
  };
}

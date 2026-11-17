## 1. Setup & Configuration

- [x] 1.1 Add `vitest` as a dev dependency and a `"test": "vitest run"` script to `package.json`. Verify that `pnpm install` succeeds and `pnpm test` runs (it reports no test files).
- [x] 1.2 Create the executable `scripts/generate-jwt-key.sh` (bash, `set -euo pipefail`). It does the following:
  - resolves `openssl` from `$OPENSSL` or `PATH`, probes Ed25519 support, and exits non-zero with install guidance if the probe fails
  - generates the key into a `mktemp` file that a `trap` removes
  - extracts the raw `d`/`x` (the last 32 bytes of the DER) and base64url-encodes them
  - sets `kid` to the RFC 7638 thumbprint (`openssl dgst -sha256 -binary` of `{"crv":"Ed25519","kty":"OKP","x":"…"}`)
  - prints the one-line private JWK and the public JWK

  Add `"keys:generate": "bash scripts/generate-jwt-key.sh"`. Verify three things:
  - `pnpm keys:generate` prints a private JWK with `kty:"OKP"`, `crv:"Ed25519"`, `x`, `d` and `kid`, and a public JWK without `d`
  - `OPENSSL=/usr/bin/openssl pnpm keys:generate` fails with the guidance message on macOS
  - no temporary key file remains afterwards
- [x] 1.3 Add `TOKEN_ISSUER: "42trees"` and `TOKEN_TTL_SECONDS: "2592000"` to `vars` in `wrangler.jsonc`. Put a generated `JWT_PRIVATE_KEY` in a local `.dev.vars`. Run `pnpm cf-typegen` and verify that `worker-configuration.d.ts` declares all three bindings.

## 2. Token Service

- [x] 2.1 Create `src/application/token-service.ts` with the `TokenClaims`, `PublicJwk` and `TokenService` types (`issueToken`, `getPublicKeys`). Verify with `pnpm exec tsc --noEmit`.
- [x] 2.2 Create `src/infra/hono-token-service.ts` with `newHonoTokenService({ jwk, issuer, ttlSeconds, now?, newId? })`. It does four things:
  - validates the JWK with zod (`OKP`/`Ed25519` with `d`, `x` and `kid`, otherwise it throws)
  - builds the `iss`/`sub`/`product_id`/`iat`/`exp`/`jti` payload
  - signs with `sign(payload, { ...jwk, alg: "EdDSA" })` from `hono/jwt` (the `alg` member is what makes Hono emit `kid`)
  - makes `getPublicKeys()` return the JWKS with `d` removed and `alg:"EdDSA"` and `use:"sig"` added

  Verify with `pnpm exec tsc --noEmit`.
- [x] 2.3 Write `src/infra/tests/hono-token-service.test.ts`. It covers:
  - the header (`alg`, `typ`, and a `kid` that matches `getPublicKeys()`)
  - exact claims with fixed `now`/`newId`, including no license key or hash in them
  - `exp - iat == ttlSeconds`
  - distinct `jti` values
  - round-trip `verify` with the public JWK
  - a tampered payload failing verification
  - public keys with no `d`
  - construction throwing for a missing, malformed or non-Ed25519 key
  - signing and verifying with a JWK produced by `scripts/generate-jwt-key.sh` (a fixture pasted from a local run)

  Verify that `pnpm test` passes.

## 3. License Service Integration

- [x] 3.1 Change `newLicenseService(repo, verifier, tokenService)` in `src/application/license-service.ts` so `activate` returns `tokenService.issueToken({ productId, deviceId })` after the seat upsert. Leave the existing verifier `TODO` untouched. Verify with `pnpm exec tsc --noEmit`.
- [x] 3.2 Update `src/infra/license-handler.ts` so `activate` returns `c.json({ token }, 200)`. Verify with `pnpm exec tsc --noEmit`.
- [x] 3.3 Update `initApp()` in `src/index.ts`. It builds the token service from `JWT_PRIVATE_KEY`, `TOKEN_ISSUER` and `TOKEN_TTL_SECONDS` (defaults `"42trees"` and `2592000`) before the license service, then passes it in. Verify with `pnpm exec tsc --noEmit`.

## 4. JWKS Endpoint

- [x] 4.1 Register `GET /v1/jwks` in `src/index.ts`. It returns `tokenService.getPublicKeys()` with `Cache-Control: public, max-age=300`. Verify that under `pnpm dev`, `curl -i localhost:8787/v1/jwks` returns `200`, the cache header, and a key with `kty/crv/x/kid/alg/use` and no `d`.

## 5. End-to-End Verification

- [x] 5.0 Fix the Gumroad verifier URL, which blocked 5.1. In `src/infra/gumroad-license-verifier.ts`, ky 2's `baseUrl` resolved `"/licenses/verify"` against the origin root, so requests went to `https://api.gumroad.com/licenses/verify` (404). Switch to ky 2's `prefix` option (the replacement for `prefixUrl`). Verify that under `pnpm dev` the log shows requests to `https://api.gumroad.com/v2/licenses/verify`.
- [x] 5.1 Write `src/application/tests/license-service.test.ts`, which exercises `LicenseService.activate` with an accepting stub verifier, an in-memory repo and the real Hono token service. (This replaces a manual `/v1/activate` run, because no real Gumroad product or license is available; the real Gumroad path stays unverified end to end.) Verify that `pnpm test` passes and that the test asserts:
  - a seat is recorded for the request's product and device
  - the header has `alg:"EdDSA"` and the `kid` from `getPublicKeys()`
  - the token verifies against the published public key with `iss` checked
  - the claims match the request, `exp - iat` equals the lifetime, and neither the license key nor its hash appears in the payload
- [x] 5.2 Remove `JWT_PRIVATE_KEY` from `.dev.vars`, restart, and verify that neither `/v1/activate` nor `/v1/jwks` returns `200`, and that neither returns a token or key set (the exact status and body are deferred to the error-handling change). Then restore the key.
- [x] 5.3 Add a README section that covers:
  - generating the key (`pnpm keys:generate`, which needs OpenSSL 1.1.1+)
  - setting the secret (`wrangler secret put JWT_PRIVATE_KEY`)
  - how clients verify tokens (embedded public JWK or `GET /v1/jwks`, `EdDSA`, checking `iss`/`product_id`/`exp`)

  Verify that the README renders the new section.

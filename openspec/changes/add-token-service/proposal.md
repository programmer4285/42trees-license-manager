## Why

Activating a license currently records a seat and returns `204 No Content`, so the client app gets nothing it can use to prove it is licensed. Client apps need a signed, tamper-evident license token they can verify offline with a public key. Then they don't have to call the license server on every launch.

## What Changes

- Add an in-process **token service** to the existing Worker that signs JWTs with **EdDSA (Ed25519)** using Hono's JWT helper (`hono/jwt`). The license service uses it to issue a license token when a seat is activated.
- **BREAKING**: `POST /v1/activate` returns `200` with a JSON body `{ "token": "<jwt>" }` instead of `204`.
- Add `GET /v1/jwks`, which publishes the public signing key as a JWKS so verifiers can fetch it by `kid`.
- Add a bash script (`openssl`-based) that generates an Ed25519 key pair and prints two things: the private JWK to store as a Worker secret, and the public JWK to embed in client apps.
- Add Worker configuration: the `JWT_PRIVATE_KEY` secret and the `TOKEN_ISSUER` and `TOKEN_TTL_SECONDS` vars.

Out of scope: error handling (mapping errors to HTTP statuses and response bodies, and rejecting licenses the verifier reports as invalid). A dedicated follow-up change will cover it.

## Capabilities

### New Capabilities
- `license-token`: Issuing EdDSA-signed license tokens on activation, their header and claims, and publishing the public key (JWKS) for offline verification.

### Modified Capabilities
<!-- None: there are no existing specs under openspec/specs/. -->

## Impact

- **Code**:
  - New `src/application/token-service.ts` (port and claim types).
  - New `src/infra/hono-token-service.ts` (Hono JWT adapter).
  - New JWKS route.
  - Changes to `src/application/license-service.ts`, `src/infra/license-handler.ts` and `src/index.ts`.
- **API**: The `/v1/activate` response changes from 204 to 200 with a JSON body. There is a new public `GET /v1/jwks`.
- **Config/Secrets**:
  - `wrangler.jsonc` vars.
  - A `JWT_PRIVATE_KEY` secret: `wrangler secret put` in production, `.dev.vars` locally.
  - Regenerate `worker-configuration.d.ts` with `pnpm cf-typegen`.
- **Dependencies**: No new runtime dependency (`hono` is already installed and `hono/jwt` supports EdDSA). `vitest` is added as a dev dependency for unit tests. The key script needs OpenSSL 1.1.1+ (for example, Homebrew `openssl@3`); the macOS system LibreSSL lacks Ed25519.
- **Clients**: Client apps must read the token from the activate response and verify it with the embedded or JWKS-served public key.

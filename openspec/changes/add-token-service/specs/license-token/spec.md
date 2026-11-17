## Purpose

Issues EdDSA-signed license tokens when a license seat is activated. It also publishes the matching public key, so client apps can verify their license offline without contacting the license server.

## ADDED Requirements

### Requirement: Activation returns a signed license token
When `POST /v1/activate` succeeds, the system SHALL respond with HTTP `200` and a JSON body `{ "token": "<compact JWS>" }`. The token is a license token for the activated seat.

#### Scenario: Successful activation
- **WHEN** a client posts a valid `licenseKey`, `productId` and `deviceId` to `/v1/activate`, and the license verifier accepts the license
- **THEN** the response status is `200`, the `Content-Type` is `application/json`, and the body contains a `token` string made of three base64url segments separated by `.`

#### Scenario: Re-activation of the same device
- **WHEN** a client activates the same license on the same `deviceId` a second time
- **THEN** the response status is `200` and the body contains a newly issued token with a fresh `iat` and `exp`

### Requirement: Tokens are signed with EdDSA over Ed25519
Every license token SHALL be a JWS signed with the Ed25519 curve. Its protected header SHALL contain `alg` = `"EdDSA"`, `typ` = `"JWT"`, and a `kid` that identifies the signing key.

#### Scenario: Header contents
- **WHEN** an issued token's header is decoded
- **THEN** `alg` is `"EdDSA"`, `typ` is `"JWT"`, and `kid` equals the `kid` of a key published at `/v1/jwks`

#### Scenario: Signature verifies with the public key
- **WHEN** a standard JWT library verifies an issued token using the published Ed25519 public key and the `EdDSA` algorithm
- **THEN** verification succeeds

#### Scenario: Tampered token is rejected
- **WHEN** any byte of an issued token's payload is altered and the token is verified with the published public key
- **THEN** verification fails

### Requirement: License token claims
Every license token payload SHALL contain these claims, and no others:
- `iss`: the configured issuer
- `sub`: the activated `deviceId`
- `product_id`: the activated `productId`
- `iat`: issue time in NumericDate seconds
- `exp`: `iat` plus the configured token lifetime
- `jti`: a unique identifier for the token

The payload MUST NOT contain the license key or any value derived from it.

#### Scenario: Claims match the activation request
- **WHEN** a token is issued for `productId` = `P` and `deviceId` = `D`
- **THEN** the payload has `sub` = `D`, `product_id` = `P`, and `iss` equal to the configured issuer

#### Scenario: Expiry reflects configured lifetime
- **WHEN** a token is issued while the token lifetime is configured as `T` seconds
- **THEN** `exp - iat` equals `T`

#### Scenario: Default lifetime
- **WHEN** no token lifetime is configured
- **THEN** `exp - iat` equals `2592000` (30 days)

#### Scenario: License key is not disclosed
- **WHEN** an issued token's payload is decoded
- **THEN** neither the license key nor its hash appears in any claim

#### Scenario: Unique token identifiers
- **WHEN** two tokens are issued, even for the same device and product
- **THEN** their `jti` values differ

### Requirement: Public key published as JWKS
The system SHALL serve `GET /v1/jwks` without authentication. The response SHALL be a JSON Web Key Set containing the public half of the active signing key. Each published key SHALL have `kty` = `"OKP"`, `crv` = `"Ed25519"`, `x`, `kid`, `alg` = `"EdDSA"` and `use` = `"sig"`. The response MUST NOT include private key material.

#### Scenario: Fetch JWKS
- **WHEN** a client sends `GET /v1/jwks`
- **THEN** the response status is `200` and the body is `{ "keys": [ ... ] }`, with at least one key that has the fields above

#### Scenario: No private material
- **WHEN** the JWKS response is inspected
- **THEN** no key contains a `d` member

#### Scenario: Cacheable response
- **WHEN** a client sends `GET /v1/jwks`
- **THEN** the response includes a `Cache-Control` header that allows public caching for a bounded duration

### Requirement: Signing key misconfiguration prevents issuance
If the signing key is missing, malformed, or is not an Ed25519 private key with a `kid`, the system MUST NOT issue a token or serve a JWKS. The HTTP status and body of the failure response are not defined by this capability.

#### Scenario: Missing signing key
- **WHEN** the signing key is not configured and a client activates a license
- **THEN** the response is not `200` and the body contains no token

#### Scenario: Wrong key type
- **WHEN** the configured signing key is not an Ed25519 (`OKP`/`Ed25519`) private key and a client requests `/v1/jwks`
- **THEN** the response is not `200` and contains no key set

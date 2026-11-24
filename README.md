# 42trees-license-manager

The license manager is a small API that sits between applications and a license provider such as Gumroad. It's responsible for verifying licenses via Gumroad's API, counting the number of devices that are using a particular license, and keeping track of when each device last verified its license.

If a license is successfully verified, the manager issues a signed JWT that is valid for 30 days. The app can verify the token using the public keys provided by the manager, and once the token expires the app should re-validate the license and get a new token.

## How seats work

A seat is one device that uses one license key. The first time a device activates a key, it takes a free seat. When the device activates the same key again later, it keeps the same seat. The service only updates the time it last saw that device. When all seats for a key are taken, additional devices cannot use that license. The devices that already hold seats keep working.

## Using the license manager from an application

### 1. Generate a device ID

Each application should generate a UUID deviceId the first time it runs. The deviceId should be persisted permanently. Always use this deviceId when verifying license keys.

### 2. Activate the license

When the customer enters their license key, send it to the service:

```http
POST /v1/activate
Content-Type: application/json

{
 "licenseKey": "ABCD1234-EF567890-12345678-90ABCDEF",
 "productId": "the-gumroad-product-id",
 "deviceId": "3f1c2b9e-8a47-4d2e-9c61-0b5f7e2a4d18"
}
```

If the key is valid and a seat is available, the license manager returns a JWT:

```json
{ "token": "eyJhbGciOiJFZERTQSIs..." }
```

### 3. Use the token for authorization

The token is valid for 30 days and should be cached. The application can periodically verify the token's signature offline in place of calling the license activation endpoint. Public keys can be retrieved from `GET /v1/jwks`.

When verifying the token, make sure the following invariants are true:

- The signature is valid, and the signing method is `EdDSA`.
- `iss` is `42trees`.
- `product_id` is your product's ID.
- `sub` is the device ID that this app saved.
- `exp`, the time the token expires, has not passed yet.

## API Reference

### `POST /v1/activate`

Verifies a license key with Gumroad, claims or refreshes a seat for the device, and returns a new JWT. Call it again with the same license key and deviceId to renew the token. The device keeps its seat.

Request body:

| Field        | Type   | Description                                     |
| ------------ | ------ | ----------------------------------------------- |
| `licenseKey` | string | The license key the customer bought on Gumroad. |
| `productId`  | string | The Gumroad product ID.                         |
| `deviceId`   | string | The UUID the application generated for itself.  |

A successful response returns `200`:

```json
{ "token": "eyJhbGciOiJFZERTQSIs..." }
```

This endpoint is rate limited to 20 requests per minute per IP address.

### `GET /v1/jwks`

Returns the public keys used to verify token signatures, in JWKS format. Responses can be cached for 5 minutes.

```json
{
  "keys": [
    { "kty": "OKP", "crv": "Ed25519", "x": "...", "kid": "...", "alg": "EdDSA", "use": "sig" }
  ]
}
```

### Token claims

| Claim        | Description                                                 |
| ------------ | ----------------------------------------------------------- |
| `iss`        | The issuer, `42trees`.                                      |
| `sub`        | The deviceId the token was issued to.                       |
| `product_id` | The Gumroad product ID.                                     |
| `iat`        | When the token was issued, in seconds since the Unix epoch. |
| `exp`        | When the token expires, 30 days after `iat`.                |
| `jti`        | A unique ID for the token.                                  |

The token header contains a `kid` that matches one of the keys from `GET /v1/jwks`.

### Errors

Errors return a JSON body such as `{ "error": "SeatLimitReached" }`.

| Status | Error                 | Meaning                                                                    |
| ------ | --------------------- | -------------------------------------------------------------------------- |
| 400    | `InvalidRequest`      | The body isn't valid JSON, a field is missing, or `deviceId` isn't a UUID. |
| 403    | `LicenseRefunded`     | The purchase was refunded.                                                 |
| 403    | `LicenseDisputed`     | The purchase has a payment dispute that wasn't won.                        |
| 403    | `SeatLimitReached`    | Every seat for the license is held by other devices.                       |
| 404    | `LicenseNotFound`     | Gumroad doesn't recognize the license key for this product.                |
| 429    | `RateLimited`         | Too many requests from this IP address.                                    |
| 500    | `InternalServerError` | An unexpected error in the license manager.                                |
| 503    | `UpstreamUnavailable` | The license manager couldn't reach Gumroad. Retry later.                   |

The 403 and 404 errors mean the license is no longer valid, and the application should discard its cached token. The 429, 500, and 503 errors aren't about the license, so the application should keep its cached token and retry later.

## Code Examples

This example uses [`jose`](https://github.com/panva/jose) to verify the token. It generates a deviceId, activates a license, fetches the public keys, and verifies the token.

```ts
import { createLocalJWKSet, jwtVerify } from "jose";

const LICENSE_MANAGER_URL = "https://api.license-manager.com";
const PRODUCT_ID = "<the gumroad product id>";

// Generate this once on first run and persist it. Reuse it on every later run.
const deviceId = crypto.randomUUID();

const activateRes = await fetch(`${LICENSE_MANAGER_URL}/v1/activate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    licenseKey: "ABCD1234-EF567890-12345678-90ABCDEF", // This is provided by the user
    productId: PRODUCT_ID,
    deviceId,
  }),
});

if (!activateRes.ok) {
  const { error } = await activateRes.json();
  throw new Error(`License activation failed: ${error}`);
}

const { token } = await activateRes.json();

// Cache the keys with the token so the application can verify it offline.
const jwks = await fetch(`${LICENSE_MANAGER_URL}/v1/jwks`).then((res) => res.json());

const { payload } = await jwtVerify(token, createLocalJWKSet(jwks), {
  algorithms: ["EdDSA"],
  issuer: "42trees",
  subject: deviceId,
});

if (payload.product_id !== PRODUCT_ID) {
  throw new Error("The token was issued for a different product");
}
```

`jwtVerify` checks the signature, `iss`, `sub`, and `exp`, and throws if any of them fail. It doesn't know about `product_id`, so the application checks that claim itself.

## Developer Reference

Install dependencies with [Bun](https://bun.sh):

```sh
bun install
```

Run the tests, with coverage:

```sh
bun run test
```

Generate an Ed25519 key pair for signing tokens:

```sh
bun run keys:gen
```

The script prints a private JWK and a public JWK. The private JWK is the `JWT_PRIVATE_KEY` secret. For local development, put it in `.env.local`:

```sh
JWT_PRIVATE_KEY='{"kty":"OKP","crv":"Ed25519","x":"...","d":"...","kid":"..."}'
```

The public JWK is what `GET /v1/jwks` serves, so applications don't need it directly.

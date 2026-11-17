#!/usr/bin/env bash
# Generates an Ed25519 key pair for signing license JWTs (EdDSA).
# Prints the private JWK (store as the JWT_PRIVATE_KEY secret) and the
# public JWK (embed in client apps). The kid is the RFC 7638 thumbprint.
set -euo pipefail

OPENSSL="${OPENSSL:-openssl}"

if ! command -v "$OPENSSL" >/dev/null 2>&1 ||
  ! "$OPENSSL" genpkey -algorithm ed25519 >/dev/null 2>&1; then
  echo "error: '$OPENSSL' cannot generate Ed25519 keys." >&2
  echo "Install OpenSSL 1.1.1+ (e.g. 'brew install openssl@3') and re-run with" >&2
  echo "OPENSSL=\$(brew --prefix openssl@3)/bin/openssl" >&2
  exit 1
fi

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

b64url() {
  base64 | tr '+/' '-_' | tr -d '=\n'
}

"$OPENSSL" genpkey -algorithm ed25519 -out "$tmp" 2>/dev/null

# Ed25519 PKCS#8 and SPKI DER encodings end with the raw 32-byte key.
d="$("$OPENSSL" pkey -in "$tmp" -outform DER | tail -c 32 | b64url)"
x="$("$OPENSSL" pkey -in "$tmp" -pubout -outform DER | tail -c 32 | b64url)"

kid="$(printf '{"crv":"Ed25519","kty":"OKP","x":"%s"}' "$x" |
  "$OPENSSL" dgst -sha256 -binary | b64url)"

echo "# Private JWK (JWT_PRIVATE_KEY secret):"
printf '{"kty":"OKP","crv":"Ed25519","x":"%s","d":"%s","kid":"%s"}\n' "$x" "$d" "$kid"
echo
echo "# Public JWK (embed in clients):"
printf '{"kty":"OKP","crv":"Ed25519","x":"%s","kid":"%s","alg":"EdDSA","use":"sig"}\n' "$x" "$kid"

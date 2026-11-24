import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import app from "../index";

// Tests should use unique IPs to avoid being rate limited
function request(path: string, ip: string, init: RequestInit = {}) {
  // NOTE: the URL is arbitrary, exports.default refers to
  // the hono app in index.ts
  return exports.default.fetch(`https://api.license-manager.test${path}`, {
    ...init,
    headers: { "cf-connecting-ip": ip },
  });
}

function badActivateRequest(ip: string) {
  return request("/v1/activate", ip, { method: "POST", body: "{not json" });
}

function exhaustActivateLimit(ip: string) {
  return Promise.all(Array.from({ length: 20 }, () => badActivateRequest(ip)));
}

describe("worker entry point", () => {
  it("serves the public key built from JWT_PRIVATE_KEY", async () => {
    const res = await request("/v1/jwks", crypto.randomUUID());

    expect(res.status).toBe(200);

    // test-kid is the default from test-utils generateKey()
    expect(await res.json()).toEqual({ keys: [expect.objectContaining({ kid: "test-kid" })] });
  });

  it("rate limits /v1/activate per client after 20 requests", async () => {
    const ip = crypto.randomUUID();
    await exhaustActivateLimit(ip);

    const res = await badActivateRequest(ip);

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "RateLimited" });
  });

  it("does not rate limit /v1/jwks for a client limited on /v1/activate", async () => {
    const ip = crypto.randomUUID();
    await exhaustActivateLimit(ip);

    const res = await request("/v1/jwks", ip);

    expect(res.status).toBe(200);
  });

  describe("env var parsing", () => {
    function jwksWith(overrides: Record<string, string>) {
      return app.request("/v1/jwks", {}, { ...env, ...overrides });
    }

    it("serves requests when the config is valid", async () => {
      const res = await jwksWith({});

      expect(res.status).toBe(200);
    });

    it.each([
      ["SEAT_LIMIT", "0"],
      ["SEAT_LIMIT", "one"],
      ["SEAT_LIMIT", "1.5"],
      ["TOKEN_TTL_SECONDS", "abc"],
      ["TOKEN_TTL_SECONDS", ""],
      ["TOKEN_ISSUER", ""],
    ])("answers 500 when %s is %j", async (name, value) => {
      const res = await jwksWith({ [name]: value });

      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "InternalServerError" });
    });
  });
});

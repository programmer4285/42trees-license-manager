import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { rateLimitMiddleware, type RateLimitEnv } from "../rate-limit";
import { wideEventMiddleware, type WideEvent } from "../wide-event";

function newApp(events: WideEvent[] = []) {
  return new Hono<RateLimitEnv>()
    .use(wideEventMiddleware((e) => events.push(e)))
    .use(rateLimitMiddleware())
    .get("/", (c) => c.text("ok"));
}

// A limiter that allows the first `allowed` calls per key and records each key.
function newFakeLimiter(allowed: number) {
  const calls: string[] = [];
  const limiter: RateLimit = {
    async limit({ key }) {
      calls.push(key);
      return { success: calls.filter((k) => k === key).length <= allowed };
    },
  };
  return { limiter, calls };
}

function requestFromIP(app: ReturnType<typeof newApp>, ip: string, limiter: RateLimit) {
  return app.request("/", { headers: { "cf-connecting-ip": ip } }, { LIMITER: limiter });
}

describe("rateLimitMiddleware", () => {
  it("passes requests through while the client is under its limit", async () => {
    const { limiter } = newFakeLimiter(1);

    const res = await requestFromIP(newApp(), "203.0.113.1", limiter);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("rejects a client over its limit with 429 RateLimited", async () => {
    const events: WideEvent[] = [];
    const app = newApp(events);
    const { limiter } = newFakeLimiter(1);
    await requestFromIP(app, "203.0.113.1", limiter);

    const res = await requestFromIP(app, "203.0.113.1", limiter);

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "RateLimited" });
    expect(events.at(-1)).toMatchObject({ status: 429, outcome: "RateLimited" });
  });

  it("limits each client IP separately", async () => {
    const app = newApp();
    const { limiter, calls } = newFakeLimiter(1);
    await requestFromIP(app, "203.0.113.1", limiter);

    const res = await requestFromIP(app, "203.0.113.2", limiter);

    expect(res.status).toBe(200);
    expect(calls).toEqual(["203.0.113.1", "203.0.113.2"]);
  });
});

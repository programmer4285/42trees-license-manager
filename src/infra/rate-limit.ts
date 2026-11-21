import type { MiddlewareHandler } from "hono";
import type { WideEventEnv } from "./wide-event";

export type RateLimitEnv = { Bindings: { LIMITER: RateLimit } } & WideEventEnv;

// rate limit by IP using cloudflare's rate limiting binding. cloudflare
// sets cf-connecting-ip for every request
export function rateLimitMiddleware<E extends RateLimitEnv>(): MiddlewareHandler<E> {
  return async (c, next) => {
    const key = c.req.header("cf-connecting-ip") ?? "unknown";
    const { success } = await c.env.LIMITER.limit({ key });
    if (!success) {
      c.var.event.outcome = "RateLimited";
      return c.json({ error: "RateLimited" }, 429);
    }

    await next();
  };
}

import type { MiddlewareHandler } from "hono";

export type WideEvent = Record<string, unknown>;

export type Logger = (event: WideEvent) => void;

// define a type for the hono environment so the wide event
// can be accessed via c.var
export type WideEventEnv = { Variables: { event: WideEvent } };

export const consoleLogger: Logger = (event) => {
  const status = event.status as number;
  if (status >= 500) {
    console.error(event);
    return;
  }

  console.log(event);
};

export const noopLogger: Logger = () => {};

export function getErrorFields(error: unknown) {
  return error instanceof Error
    ? { name: error.name, message: error.message }
    : { message: String(error) };
}

export function wideEventMiddleware(log: Logger): MiddlewareHandler<WideEventEnv> {
  return async (c, next) => {
    const start = Date.now();

    const event: WideEvent = {
      requestId: c.req.header("cf-ray") ?? crypto.randomUUID(),
      method: c.req.method,
      path: c.req.path,
    };

    c.set("event", event);

    await next();

    event.status = c.res.status;
    event.durationMs = Date.now() - start;

    // hono sets c.error if an exception is uncaught
    if (c.error) {
      event.error = getErrorFields(c.error);
    }

    log(event);
  };
}

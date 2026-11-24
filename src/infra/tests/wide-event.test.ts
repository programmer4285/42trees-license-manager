import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { wideEventMiddleware, type WideEvent } from "../wide-event";

describe("wideEventMiddleware", () => {
  it("records a thrown error and the error response status", async () => {
    const events: WideEvent[] = [];
    const app = new Hono()
      .use(wideEventMiddleware((e) => events.push(e)))
      .get("/boom", () => {
        throw new TypeError("kaboom");
      })
      .onError((_, c) => c.json({ error: "InternalServerError" }, 500));

    await app.request("/boom");

    expect(events).toEqual([
      expect.objectContaining({
        status: 500,
        error: { name: "TypeError", message: "kaboom" },
      }),
    ]);
  });
});

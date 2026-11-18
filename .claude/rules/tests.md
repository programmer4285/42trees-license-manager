---
paths:
  - "src/**/*.test.ts"
---

# Unit tests follow Arrange, Act, Assert

Every `it` body has three blocks in this order, separated by one blank line:

1. **Arrange.** Build the inputs, fakes, and system under test. Leave it out when there is nothing to set up.
2. **Act.** One call to the behavior under test, usually assigned to a variable (`const res = await activate(app, body)`).
3. **Assert.** Only `expect` and `assert` calls, plus pure reads of the act's result needed to state them.

```ts
it("refuses a third device and records no seat for it", async () => {
  const { licenseRepo, service } = await newService();
  await service.activate(onDevice(crypto.randomUUID()));
  await service.activate(onDevice(crypto.randomUUID()));

  const result = await service.activate(onDevice(crypto.randomUUID()));

  expect(result).toEqual({ ok: false, error: { kind: "SeatLimitReached" } });
  expect(licenseRepo.seats).toHaveLength(2);
});
```

Rules:

- Do not label blocks with `// arrange`, `// act`, `// assert` comments. The blank lines carry the structure.
- One act per test. If a test needs act, assert, act, assert, split it into multiple tests, or move the earlier calls into Arrange when they only set up state.
- When the behavior is a relation between calls (two tokens get distinct ids), Act may hold those calls together.
- When the assertion must wrap the call (`expect(() => f()).toThrow()`, `await expect(p).rejects`), Act and Assert merge into one block. Do this only when the matcher needs it.
- Calls that create the state the test needs belong in Arrange, even when they invoke the same function as Act (the two setup `activate` calls above).
- No branching (`if`, `switch`, loops) in any block. Use `it.each` for variations.
- Shared setup that repeats across tests goes in a local factory such as `newApp()` or `newService()`, not in `beforeEach` with mutable outer variables.
- A setup check that guards the act (`assert(result.ok, ...)` to narrow a type) belongs in Assert when it checks the act's result, and in Arrange when it checks setup.

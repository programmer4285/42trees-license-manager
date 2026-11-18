import { readdir, readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import type { LicenseRepo } from "../../domain/license-repo";
import { newSeat } from "../../domain/seat";
import { newD1LicenseRepo } from "../d1-license-repo";
import { newInMemoryLicenseRepo } from "../inmemory-license-repo";

let proxy: Awaited<ReturnType<typeof getPlatformProxy<CloudflareBindings>>>;

// applies every migration in filename order. D1's exec() treats each line as a
// statement, so statements are split on ";" and prepared one by one instead
async function applyMigrations(db: D1Database) {
  const files = (await readdir("migrations")).filter((f) => f.endsWith(".sql")).toSorted();
  for (const file of files) {
    const sql = await readFile(`migrations/${file}`, "utf8");
    const statements = sql
      .replaceAll(/--.*$/gm, "") // remove comments, if they contain ; the split won't work
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    await db.batch(statements.map((s) => db.prepare(s)));
  }
}

beforeAll(async () => {
  // setup a real sqlite db for testing
  proxy = await getPlatformProxy<CloudflareBindings>({ persist: false });
  await applyMigrations(proxy.env.DB);
}, 30_000);

afterAll(() => proxy.dispose());

const repos: [string, () => LicenseRepo][] = [
  ["in-memory", () => newInMemoryLicenseRepo()],
  ["D1", () => newD1LicenseRepo(proxy.env.DB)],
];

describe.each(repos)("%s license repo", (_, newRepo) => {
  // each test uses a fresh license hash so tests sharing one D1 don't conflict
  function seatFor(licenseHash: string, deviceId: string = crypto.randomUUID()) {
    return newSeat({ productId: "product", deviceId, licenseHash });
  }

  it("creates seats until the license reaches its limit", async () => {
    const repo = newRepo();
    const license = crypto.randomUUID();

    const seatClaim1 = await repo.claimSeat(seatFor(license), 2);
    const seatClaim2 = await repo.claimSeat(seatFor(license), 2);
    const seatClaim3 = await repo.claimSeat(seatFor(license), 2);

    expect(seatClaim1).toBe("created");
    expect(seatClaim2).toBe("created");
    expect(seatClaim3).toBe("unavailable");
  });

  it("refreshes a device's existing seat even when the license is full", async () => {
    const repo = newRepo();
    const license = crypto.randomUUID();
    const device = crypto.randomUUID();

    await repo.claimSeat(seatFor(license, device), 1);
    const seatClaim = await repo.claimSeat(seatFor(license, device), 1);

    expect(seatClaim).toBe("refreshed");
  });

  it("does not let a full license block a seat on another license", async () => {
    const repo = newRepo();
    const device = crypto.randomUUID();

    await repo.claimSeat(seatFor(crypto.randomUUID(), device), 1);
    const seatClaim = await repo.claimSeat(seatFor(crypto.randomUUID(), device), 1);

    expect(seatClaim).toBe("created");
  });
});

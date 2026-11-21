import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import type { LicenseRepo } from "../../domain/license-repo";
import { newSeat } from "../../domain/seat";
import { newD1LicenseRepo } from "../d1-license-repo";
import { newInMemoryLicenseRepo } from "../inmemory-license-repo";

const repos: [string, () => LicenseRepo][] = [
  ["in-memory", () => newInMemoryLicenseRepo()],
  ["D1", () => newD1LicenseRepo(env.DB)],
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

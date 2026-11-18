import { LicenseRepo } from "../domain/license-repo";

export function newD1LicenseRepo(d1: D1Database): LicenseRepo {
  return {
    async claimSeat(seat, limit) {
      const row = await d1
        .prepare(
          `INSERT INTO seats (
            id,
            product_id,
            license_hash,
            device_id,
            created_at,
            last_seen_at
          )
          SELECT ?1, ?2, ?3, ?4, ?5, ?6
          WHERE (SELECT COUNT(*) FROM seats WHERE license_hash = ?3) < ?7
            OR EXISTS (SELECT 1 FROM seats WHERE license_hash = ?3 AND device_id = ?4)
          ON CONFLICT (license_hash, device_id)
          DO UPDATE SET last_seen_at = excluded.last_seen_at
          RETURNING id`,
        )
        .bind(
          seat.id,
          seat.productId,
          seat.licenseHash,
          seat.deviceId,
          seat.createdAt.toISOString(),
          seat.lastSeenAt.toISOString(),
          limit,
        )
        .first<{ id: string }>();

      if (!row) {
        return "unavailable";
      }

      return row.id === seat.id ? "created" : "refreshed";
    },
  };
}

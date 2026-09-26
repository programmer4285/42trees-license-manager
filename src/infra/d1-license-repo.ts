import { LicenseRepo } from "../domain/license-repo";
import { Seat } from "../domain/seat";

type SeatRow = {
  id: string;
  device_id: string;
  product_id: string;
  license_hash: string;
  created_at: string;
  last_seen_at: string;
};

function rowToSeat(row: SeatRow): Seat {
  return {
    id: row.id,
    deviceId: row.device_id,
    productId: row.product_id,
    licenseHash: row.license_hash,
    createdAt: new Date(row.created_at),
    lastSeenAt: new Date(row.last_seen_at),
  };
}

export function newD1LicenseRepo(d1: D1Database): LicenseRepo {
  return {
    async insertSeat(seat: Seat): Promise<void> {
      const result = await d1
        .prepare(
          `INSERT INTO seats (
            id,
            product_id,
            license_hash,
            device_id,
            created_at,
            last_seen_at
          )
          VALUES (?1, ?2, ?3, ?4, ?5, ?6)
          ON CONFLICT (license_hash, device_id)
          DO UPDATE SET last_seen_at = excluded.last_seen_at`,
        )
        .bind(
          seat.id,
          seat.productId,
          seat.licenseHash,
          seat.deviceId,
          seat.createdAt.toISOString(),
          seat.lastSeenAt.toISOString(),
        )
        .run();

      // TODO: consider returning result.meta.changes
    },

    async updateSeat(seat: Seat): Promise<void> {
      const result = await d1
        .prepare(
          `UPDATE seats
          SET last_seen_at = ?1
          WHERE license_hash = ?2
            AND device_id = ?3`,
        )
        .bind(seat.lastSeenAt.toISOString(), seat.licenseHash, seat.deviceId)
        .run();

      // TODO: consider returning result.meta.changes
    },

    async getSeats(licenseHash: string): Promise<Seat[]> {
      const rows = await d1
        .prepare(
          `SELECT
            id,
            device_id,
            product_id,
            license_hash,
            created_at,
            last_seen_at
          FROM seats
          WHERE license_hash = ?1
          ORDER BY created_at`,
        )
        .bind(licenseHash)
        .all<SeatRow>();

      return rows.results.map((row) => rowToSeat(row));
    },
  };
}

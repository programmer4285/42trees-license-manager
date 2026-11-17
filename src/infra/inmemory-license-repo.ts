import { LicenseRepo } from "../domain/license-repo";
import { Seat } from "../domain/seat";

export function newInMemoryLicenseRepo(
  seats: Seat[] = [],
): LicenseRepo & { seats: Seat[] } {
  return {
    seats,
    async upsertSeat(seat) {
      const existing = seats.find(
        (s) =>
          s.licenseHash === seat.licenseHash && s.deviceId === seat.deviceId,
      );
      if (existing) {
        existing.lastSeenAt = seat.lastSeenAt;
      } else {
        seats.push(seat);
      }
    },
    async getSeats(licenseHash) {
      return seats.filter((s) => s.licenseHash === licenseHash);
    },
  };
}

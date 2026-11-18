import { LicenseRepo } from "../domain/license-repo";
import { Seat } from "../domain/seat";

export function newInMemoryLicenseRepo(seats: Seat[] = []): LicenseRepo & { seats: Seat[] } {
  return {
    seats,
    async claimSeat(seat, limit) {
      const licenseSeats = seats.filter((s) => s.licenseHash === seat.licenseHash);
      const existing = licenseSeats.find((s) => s.deviceId === seat.deviceId);
      if (existing) {
        existing.lastSeenAt = seat.lastSeenAt;
        return "refreshed";
      }

      if (licenseSeats.length >= limit) {
        return "unavailable";
      }

      seats.push(seat);
      return "created";
    },
  };
}

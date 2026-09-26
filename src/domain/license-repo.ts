import type { Seat } from "./seat";

export interface LicenseRepo {
  upsertSeat(seat: Seat): Promise<void>;
  getSeats(licenseHash: string): Promise<Seat[]>;
}

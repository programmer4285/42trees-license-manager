import type { Seat } from "./seat";

export interface LicenseRepo {
  insertSeat(seat: Seat): Promise<void>;
  updateSeat(seat: Seat): Promise<void>;
  getSeats(licenseHash: string): Promise<Seat[]>;
}

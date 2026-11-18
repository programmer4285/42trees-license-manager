import type { Seat } from "./seat";

export type SeatClaim = "created" | "refreshed" | "unavailable";

export interface LicenseRepo {
  // claims a seat if one is available, or refreshes the
  // seat if it already exists
  claimSeat(seat: Seat, limit: number): Promise<SeatClaim>;
}

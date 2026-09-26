export type Seat = {
  id: string;
  deviceId: string;
  productId: string;
  licenseHash: string;
  createdAt: Date;
  lastSeenAt: Date;
};

export type NewSeatProps = Omit<Seat, "id" | "createdAt" | "lastSeenAt">;

export function newSeat(props: NewSeatProps): Seat {
  const now = new Date();
  return {
    id: crypto.randomUUID(),
    deviceId: props.deviceId,
    productId: props.productId,
    licenseHash: props.licenseHash,
    createdAt: now,
    lastSeenAt: now,
  };
}

CREATE TABLE IF NOT EXISTS seats (
  id            TEXT PRIMARY KEY,
  product_id    TEXT NOT NULL,
  license_hash  TEXT NOT NULL,
  device_id     TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_seen_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS seats_license_device
  ON seats (license_hash, device_id);

-- รัน command นี้ก่อนใน psql:
-- CREATE DATABASE office_management;
-- \c office_management

CREATE TABLE IF NOT EXISTS bookings (
  id          TEXT PRIMARY KEY,
  item_id     TEXT NOT NULL,
  type        TEXT NOT NULL,
  user_id     TEXT,
  user_name   TEXT,
  date        TEXT NOT NULL,
  start_time  TEXT NOT NULL,
  end_time    TEXT NOT NULL,
  purpose     TEXT,
  is_release  BOOLEAN DEFAULT FALSE,
  release_key TEXT,
  timestamp   BIGINT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(date);

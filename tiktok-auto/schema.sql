CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tokens (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  open_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  access_expires_at INTEGER,
  refresh_expires_at INTEGER,
  scope TEXT,
  updated_at INTEGER
);

-- status: running | processing | ok | failed | skipped
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  set_name TEXT,
  mode TEXT,
  status TEXT NOT NULL,
  publish_id TEXT,
  tiktok_status TEXT,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS posts_day ON posts(day);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER,
  level TEXT,
  msg TEXT
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  created_at INTEGER
);

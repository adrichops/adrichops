-- Isolated hunt tables. No statements target existing Adrichops tables.
CREATE TABLE IF NOT EXISTS birthday_settings (
  id INTEGER PRIMARY KEY CHECK(id=1), status TEXT NOT NULL DEFAULT 'lobby'
    CHECK(status IN ('lobby','live','paused')),
  started_at TEXT, elapsed_ms INTEGER NOT NULL DEFAULT 0,
  resumed_at INTEGER, version INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO birthday_settings(id) VALUES(1);
CREATE TABLE IF NOT EXISTS birthday_teams (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, code_hash TEXT UNIQUE NOT NULL,
  stage INTEGER NOT NULL DEFAULT 1 CHECK(stage BETWEEN 1 AND 10),
  phase TEXT NOT NULL DEFAULT 'puzzle' CHECK(phase IN ('puzzle','travel','finished')),
  score INTEGER NOT NULL DEFAULT 0 CHECK(score BETWEEN 0 AND 100),
  hints INTEGER NOT NULL DEFAULT 0, wrong INTEGER NOT NULL DEFAULT 0,
  started_at TEXT, finished_at TEXT, started_elapsed_ms INTEGER NOT NULL DEFAULT 0,
  finished_elapsed_ms INTEGER, version INTEGER NOT NULL DEFAULT 0,
  verified_stage INTEGER NOT NULL DEFAULT 0,
  selfie_status TEXT NOT NULL DEFAULT 'none' CHECK(selfie_status IN ('none','pending','retry')),
  selfie_requested_at TEXT,
  archived INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS birthday_puzzles (stage INTEGER PRIMARY KEY CHECK(stage BETWEEN 1 AND 10), payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS birthday_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, team_id TEXT, action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '', occurred_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS birthday_sessions (
  token_hash TEXT PRIMARY KEY, role TEXT NOT NULL, team_id TEXT,
  expires_at INTEGER NOT NULL, auth_version TEXT
);
CREATE INDEX IF NOT EXISTS birthday_sessions_expiry ON birthday_sessions(expires_at);
CREATE INDEX IF NOT EXISTS birthday_sessions_team ON birthday_sessions(team_id);
CREATE TABLE IF NOT EXISTS birthday_limits (key TEXT PRIMARY KEY, hits INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS birthday_limits_expiry ON birthday_limits(expires_at);

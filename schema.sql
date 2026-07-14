CREATE TABLE IF NOT EXISTS feedback_submissions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  page_url TEXT NOT NULL,
  pathname TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at
  ON feedback_submissions (created_at);

CREATE INDEX IF NOT EXISTS idx_feedback_pathname
  ON feedback_submissions (pathname);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'subscribed',
  source_url TEXT,
  pathname TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_newsletter_status
  ON newsletter_subscribers (status);

CREATE TABLE IF NOT EXISTS maker_change_suggestions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  implemented_at TEXT,
  request_type TEXT NOT NULL,
  region_id TEXT,
  node_id TEXT,
  node_name TEXT,
  role TEXT,
  aliases TEXT,
  specialty TEXT,
  famous_lines TEXT,
  relationship_from TEXT,
  relationship_to TEXT,
  relationship_kind TEXT,
  relationship_label TEXT,
  relationship_detail TEXT,
  source_label TEXT,
  source_url TEXT,
  confidence TEXT,
  submitter_name TEXT,
  submitter_email TEXT NOT NULL,
  notes TEXT,
  page_url TEXT,
  pathname TEXT,
  user_agent TEXT,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_maker_change_suggestions_status
  ON maker_change_suggestions (status);

CREATE INDEX IF NOT EXISTS idx_maker_change_suggestions_created_at
  ON maker_change_suggestions (created_at);

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

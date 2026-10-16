-- Apply once to existing hunt databases before deploying the selfie gate.
ALTER TABLE birthday_teams ADD COLUMN verified_stage INTEGER NOT NULL DEFAULT 0;
ALTER TABLE birthday_teams ADD COLUMN selfie_status TEXT NOT NULL DEFAULT 'none' CHECK(selfie_status IN ('none','pending','retry'));
ALTER TABLE birthday_teams ADD COLUMN selfie_requested_at TEXT;

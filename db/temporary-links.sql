CREATE TABLE IF NOT EXISTS wifi_print_links (
  token_hash CHAR(64) PRIMARY KEY,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '6 hours'),
  CONSTRAINT wifi_print_links_lifetime CHECK (expires_at = created_at + INTERVAL '6 hours')
);
CREATE INDEX IF NOT EXISTS idx_wifi_print_links_expires_at ON wifi_print_links (expires_at);

-- WiFi Networks History
-- Execute este script no Neon SQL Editor para criar a tabela.

CREATE TABLE IF NOT EXISTS wifi_networks (
  id                 SERIAL PRIMARY KEY,
  ssid               VARCHAR(64)   NOT NULL,
  ssid_5g            VARCHAR(64)   DEFAULT '',
  dual_band          BOOLEAN       NOT NULL DEFAULT TRUE,
  password           VARCHAR(128)  DEFAULT '',
  security           VARCHAR(16)   NOT NULL DEFAULT 'WPA',
  hidden             BOOLEAN       NOT NULL DEFAULT FALSE,
  eap_method         VARCHAR(16),
  identity           VARCHAR(128),
  eap_password       VARCHAR(128),
  phase2             VARCHAR(64),
  anonymous_identity VARCHAR(128),
  contract           VARCHAR(128),
  extra_networks     JSONB         NOT NULL DEFAULT '[]'::jsonb,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wifi_created_at ON wifi_networks (created_at DESC);

-- Migração: adiciona coluna contract se a tabela já existir
ALTER TABLE wifi_networks ADD COLUMN IF NOT EXISTS contract VARCHAR(128);
ALTER TABLE wifi_networks ADD COLUMN IF NOT EXISTS ssid_5g VARCHAR(64) DEFAULT '';
ALTER TABLE wifi_networks ADD COLUMN IF NOT EXISTS dual_band BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE wifi_networks ADD COLUMN IF NOT EXISTS extra_networks JSONB NOT NULL DEFAULT '[]'::jsonb;

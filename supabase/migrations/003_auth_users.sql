-- ----------------------------------------------------------
-- auth_users
-- Tracks successful logins in Supabase without storing secrets
-- ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS auth_users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id        uuid NOT NULL,
  email            text NOT NULL,
  name             text NOT NULL,
  role             text NOT NULL,
  agency_id        uuid,
  user_agent       text,
  ip_address       text,
  last_login_at    timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_users_broker_id
  ON auth_users (broker_id);

CREATE INDEX IF NOT EXISTS idx_auth_users_email
  ON auth_users (email);

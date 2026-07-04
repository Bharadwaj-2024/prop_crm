-- ============================================================
-- Call-Centric AI CRM — Initial Schema
-- Run via: supabase db push  OR  paste into Supabase SQL editor
-- ============================================================

-- Enable uuid generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------
-- leads
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone            text UNIQUE NOT NULL,
  name             text,
  budget_min       integer,          -- in lakhs
  budget_max       integer,          -- in lakhs
  location         text,             -- area / locality
  bhk              text,             -- e.g. "2BHK", "3BHK"
  intent           text,             -- serious_buyer | just_browsing | investor
  timeline         text,             -- immediate | 3_months | 6_months | 12_months | unknown
  summary          text,             -- 1-2 line AI summary of the call
  stage            text NOT NULL DEFAULT 'new',
  last_contact_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------
-- timeline_events
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS timeline_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_phone       text NOT NULL REFERENCES leads(phone) ON DELETE CASCADE,
  channel          text NOT NULL,    -- call | whatsapp
  direction        text NOT NULL,    -- inbound | outbound
  duration_sec     integer,
  transcript       text,
  extracted_fields jsonb,
  intent_tag       text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timeline_events_lead_phone_created
  ON timeline_events (lead_phone, created_at DESC);

-- ----------------------------------------------------------
-- Row-Level Security (optional but recommended for prod)
-- ----------------------------------------------------------
-- Uncomment after you set up Supabase auth roles:
-- ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;

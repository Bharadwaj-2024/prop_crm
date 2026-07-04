-- ============================================================
-- Feature 2: WhatsApp Intelligence
-- Run in Supabase SQL editor after 001_init.sql
-- ============================================================

-- Raw WhatsApp messages table
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wamid           text UNIQUE NOT NULL,
  from_phone      text NOT NULL,
  to_phone        text NOT NULL,
  message_type    text NOT NULL,         -- text | image | audio | document
  message_body    text,
  media_id        text,
  media_url       text,
  timestamp       timestamptz NOT NULL,
  processed       boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

-- WhatsApp fields on leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp_phone text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp_opted_in boolean DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_whatsapp_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS preferred_channel text DEFAULT 'call';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_from
  ON whatsapp_messages (from_phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wamid
  ON whatsapp_messages (wamid);

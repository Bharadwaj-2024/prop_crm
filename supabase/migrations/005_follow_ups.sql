CREATE TABLE IF NOT EXISTS follow_ups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_phone      text NOT NULL REFERENCES leads(phone) ON DELETE CASCADE,
  message         text NOT NULL,
  scheduled_at    timestamptz NOT NULL,
  sent_at         timestamptz,
  status          text DEFAULT 'pending',
  follow_up_day   integer NOT NULL,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_follow_ups_scheduled
  ON follow_ups (status, scheduled_at)
  WHERE status = 'pending';

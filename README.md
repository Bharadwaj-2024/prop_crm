# 📞 Call-Centric AI CRM

Automatically converts broker phone calls into structured CRM lead records using AI.

Every call that ends on Exotel triggers a pipeline that:
1. Transcribes the audio (Hindi / English / Hinglish) via **Sarvam AI**
2. Extracts structured lead fields from the transcript via **Google Gemini**
3. Upserts the lead and call history into **Supabase**
4. Displays everything on a live **Next.js dashboard**

---

## How It Works

```
Call ends on Exotel
  → POST /api/webhooks/exotel   (Next.js serverless, ~50ms response)
  → Job enqueued in BullMQ (Upstash Redis)
  → Worker process picks it up:
      1. Fetch recording URL from Exotel
      2. Transcribe audio → Sarvam AI  (saarika:v2, hi-IN)
      3. Extract fields → Gemini 2.0 Flash  (JSON output)
      4. Upsert lead + insert timeline event → Supabase
  → Dashboard auto-refreshes (ISR every 30s)
```

**Retry logic:** If the recording isn't ready when the webhook fires, BullMQ retries with exponential backoff — 5 attempts at 3 s → 6 s → 12 s → 24 s → 48 s.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, TypeScript) |
| Queue | BullMQ 5 + Upstash Redis (IORedis) |
| Transcription | Sarvam AI (`saarika:v2`) |
| AI Extraction | Google Gemini 2.0 Flash |
| Database | Supabase (PostgreSQL) |
| Call Provider | Exotel (VoIP + webhooks) |
| Deployment | Vercel (Next.js) + Railway/Render (worker) |

---

## Project Structure

```
crm/
├── app/
│   ├── api/webhooks/exotel/route.ts   ← Exotel webhook receiver
│   ├── dashboard/page.tsx             ← Stats dashboard (SSR)
│   └── page.tsx                       ← Main leads + transcripts view
├── lib/
│   ├── queues/callQueue.ts            ← BullMQ queue + Redis connection
│   ├── workers/callWorker.ts          ← Job processor (runs separately)
│   ├── services/
│   │   ├── sarvam.ts                  ← Speech-to-text client
│   │   └── extractLeadFields.ts       ← Gemini extraction
│   └── supabase/upsertLead.ts         ← DB writes
├── scripts/startWorker.ts             ← Worker entry point
└── supabase/migrations/001_init.sql   ← Database schema
```

---

## Database Schema

### `leads`
One row per phone number — deduplicated on `phone`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `phone` | text UNIQUE | Deduplication key |
| `name` | text | Extracted by AI |
| `budget_min` | integer | In lakhs |
| `budget_max` | integer | In lakhs |
| `location` | text | Area/locality |
| `bhk` | text | e.g. `2BHK`, `3BHK` |
| `intent` | text | `serious_buyer` / `just_browsing` / `investor` |
| `timeline` | text | `immediate` / `3_months` / `6_months` / `12_months` / `unknown` |
| `summary` | text | 2-sentence AI summary |
| `stage` | text | Default `new` |
| `last_contact_at` | timestamptz | Updated on every call |
| `created_at` | timestamptz | Immutable |

### `timeline_events`
One row per call.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key |
| `lead_phone` | text FK | References `leads.phone` |
| `channel` | text | `call` or `whatsapp` |
| `direction` | text | `inbound` or `outbound` |
| `duration_sec` | integer | Call duration in seconds |
| `transcript` | text | Full Sarvam transcript |
| `extracted_fields` | jsonb | Raw Gemini output |
| `intent_tag` | text | Shorthand intent |
| `created_at` | timestamptz | Event timestamp |

---

## Local Setup

### 1. Install dependencies

```bash
cd crm
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
# Fill in all values — see the table below
```

### 3. Run the database migration

**Option A — Supabase CLI:**
```bash
npx supabase db push
```

**Option B — Manual:**
Open Supabase Dashboard → SQL Editor → paste `supabase/migrations/001_init.sql` → Run.

### 4. Start the Next.js app (terminal 1)

```bash
npm run dev
# Webhook: http://localhost:3000/api/webhooks/exotel
```

### 5. Start the BullMQ worker (terminal 2)

```bash
npm run worker
```

> **Important:** The worker must run as a separate process. It cannot run inside Next.js serverless functions because it needs a persistent connection to Redis.

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in these values:

| Variable | Where to get it | Required |
|----------|----------------|----------|
| `EXOTEL_API_KEY` | Exotel Console → Settings → API | ✅ |
| `EXOTEL_API_TOKEN` | Exotel Console → Settings → API | ✅ |
| `EXOTEL_SID` | Exotel Console → Account SID | ✅ |
| `SARVAM_API_KEY` | dashboard.sarvam.ai → API Keys | ✅ |
| `GEMINI_API_KEY` | Google AI Studio → API Keys | ✅ |
| `UPSTASH_REDIS_URL` | Upstash Console → DB → ioredis URL (`rediss://`) | ✅ |
| `UPSTASH_REDIS_REST_URL` | Upstash Console → DB → REST API | optional |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Console → DB → REST API | optional |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | ✅ |

**Note on Upstash Redis:** BullMQ requires the **ioredis-compatible** URL that starts with `rediss://`. In the Upstash console, look for the section labeled "Connect via ioredis".

---

## Exotel Webhook Setup

1. Go to Exotel Dashboard → My Apps → your app → Settings
2. Set **Call Status Callback URL**:
   - Local dev: `https://<your-ngrok-id>.ngrok.io/api/webhooks/exotel`
   - Production: `https://<your-domain>/api/webhooks/exotel`
3. Method: `POST`

Exotel sends `application/x-www-form-urlencoded` with these key fields:

```
CallSid        — unique call ID (used as idempotent job ID)
From           — caller's phone number
Status         — completed | busy | no-answer | failed
Direction      — inbound | outbound-dial
Duration       — seconds
RecordingUrl   — may be empty immediately after the call
```

---

## Testing Locally

### Simulate a webhook call

```bash
curl -X POST http://localhost:3000/api/webhooks/exotel \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=TEST123&From=%2B919876543210&To=%2B912244556677&Status=completed&Direction=inbound&Duration=45&RecordingUrl=https://example.com/test.mp3"
```

Watch the worker terminal — it should log each pipeline step.

### Real call with ngrok

```bash
# Terminal 1
npm run dev

# Terminal 2
ngrok http 3000

# Terminal 3
npm run worker

# Set the ngrok URL as your Exotel webhook, then make a real call
```

---

## Deployment

### Next.js → Vercel

```bash
vercel deploy
```

The webhook endpoint runs as a Vercel serverless function automatically.

### Worker → Railway (recommended)

1. Create a new Railway service
2. Set the start command to `npm run worker`
3. Add all environment variables
4. Deploy

The worker and Next.js app share the same Upstash Redis queue — they don't need to be on the same server.

Other options: **Render**, **Fly.io**, **EC2/VM with PM2**.

---

## What the AI Extracts

Gemini extracts these fields from every call transcript:

| Field | Example |
|-------|---------|
| `name` | Rahul Sharma |
| `budget_min_lakhs` | 80 |
| `budget_max_lakhs` | 120 |
| `location` | Andheri West |
| `bhk` | 2BHK |
| `intent` | serious_buyer |
| `timeline` | 3_months |
| `summary` | Caller is looking for a 2BHK... |
| `next_action` | Schedule site visit this week |
| `language` | Hinglish |

Fields not mentioned in the call are returned as `null`.

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `UPSTASH_REDIS_URL is not set` | Missing or wrong env var | Use the `rediss://` ioredis URL from Upstash |
| `Recording URL not yet available` | Exotel hasn't processed recording | Normal — BullMQ retries automatically |
| `Supabase Lead upsert failed` | Schema mismatch or missing service role key | Run migration, verify `SUPABASE_SERVICE_ROLE_KEY` |
| `Sarvam 401` | Wrong API key | Check `SARVAM_API_KEY` |
| Worker not picking up jobs | Worker process not running | Start `npm run worker` in a separate terminal |
| `maxRetriesPerRequest` Redis error | ioredis config issue | Already handled in `callQueue.ts` — don't remove the option |

---

## Roadmap

- [ ] **WhatsApp integration** — receive messages via Interakt/Wati webhook, same extraction pipeline
- [ ] **Per-lead timeline page** — `/leads/[phone]` with full call history
- [ ] **Follow-up queue** — AI-suggested WhatsApp reminders via BullMQ scheduled jobs
- [ ] **Broker analytics** — calls per broker, conversion rates, average budget
- [ ] **Audio archival** — store recordings in Cloudflare R2 for playback in dashboard

---

## Services Used

| Service | Purpose | Dashboard |
|---------|---------|-----------|
| Exotel | VoIP calls + webhooks | my.exotel.com |
| Sarvam AI | Hindi/English transcription | dashboard.sarvam.ai |
| Google Gemini | Lead field extraction | aistudio.google.com |
| Upstash Redis | BullMQ job queue | console.upstash.com |
| Supabase | PostgreSQL database | supabase.com/dashboard |
| Vercel | Next.js hosting | vercel.com/dashboard |
| Railway | Worker process hosting | railway.app |

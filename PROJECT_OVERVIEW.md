# Call-Centric AI CRM — Project Overview
## Feature 1: Call Intelligence Core

This document is the single source of truth for the project.
Read this before touching any code.

---

## What This Builds

A real-time pipeline that converts every broker phone call into a structured CRM record automatically:

```
Exotel webhook → BullMQ queue → Worker picks up job
  → Sarvam AI transcribes audio (Hindi/English)
  → GPT-4o extracts lead fields as JSON
  → Supabase upserts lead + inserts timeline event
```

---

## Directory Structure

```
/
├── app/
│   └── api/
│       └── webhooks/
│           └── exotel/
│               └── route.ts          ← Exotel POST webhook receiver
├── lib/
│   ├── queues/
│   │   └── callQueue.ts              ← BullMQ queue + Redis connection + job type
│   ├── workers/
│   │   └── callWorker.ts             ← Full processing pipeline (runs as separate process)
│   ├── services/
│   │   ├── sarvam.ts                 ← Sarvam AI speech-to-text client
│   │   └── extractLeadFields.ts      ← GPT-4o JSON extraction
│   └── supabase/
│       └── upsertLead.ts             ← Supabase lead upsert + timeline event insert
├── scripts/
│   └── startWorker.ts                ← Entry point to run the worker process
├── supabase/
│   └── migrations/
│       └── 001_init.sql              ← Postgres schema (leads + timeline_events)
├── .env.example                      ← All required env vars (copy to .env.local)
├── package.json                      ← All dependencies
├── tsconfig.server.json              ← TypeScript config for worker scripts
└── PROJECT_OVERVIEW.md               ← This file
```

---

## Setup: Step by Step

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
# Fill in all values — see "Environment Variables" section below
```

### 3. Set up Supabase database

Option A — Supabase CLI:
```bash
npx supabase db push
```

Option B — Manual (paste into Supabase SQL editor):
```
Open: https://supabase.com/dashboard → your project → SQL Editor
Paste contents of: supabase/migrations/001_init.sql
Run it
```

### 4. Run Next.js (webhook receiver)

```bash
npm run dev
# Webhook endpoint: http://localhost:3000/api/webhooks/exotel
```

### 5. Run the BullMQ worker (separate terminal)

```bash
npm run worker
```

> ⚠️ The worker MUST run as a separate process. It cannot run inside Next.js
> because long-lived connections are not supported in serverless functions.

---

## Environment Variables Reference

| Variable | Where to find it | Required |
|---|---|---|
| `EXOTEL_API_KEY` | Exotel Console → Settings → API | ✅ |
| `EXOTEL_API_TOKEN` | Exotel Console → Settings → API | ✅ |
| `EXOTEL_SID` | Exotel Console → Account SID | ✅ |
| `SARVAM_API_KEY` | https://dashboard.sarvam.ai → API Keys | ✅ |
| `OPENAI_API_KEY` | https://platform.openai.com/api-keys | ✅ |
| `UPSTASH_REDIS_URL` | Upstash Console → DB → ioredis URL (`rediss://`) | ✅ |
| `UPSTASH_REDIS_REST_URL` | Upstash Console → DB → REST API | for future use |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Console → DB → REST API | for future use |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | ✅ |

### Critical: Two different Upstash URLs

Upstash exposes Redis in two ways:
- **ioredis-compatible** (`rediss://...`) — used by BullMQ via `UPSTASH_REDIS_URL`
- **REST API** (`https://...`) — used by `@upstash/redis` client

In the Upstash console, look for the section labeled **"Connect to your database"**
and copy the **ioredis** URL (starts with `rediss://`).

---

## Database Schema

### `leads` table

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | auto-generated |
| `phone` | text UNIQUE | primary key for deduplication |
| `name` | text | extracted by GPT-4o |
| `budget_min` | integer | in lakhs |
| `budget_max` | integer | in lakhs |
| `location` | text | area/locality |
| `bhk` | text | e.g. "2BHK", "3BHK" |
| `intent` | text | serious_buyer / just_browsing / investor |
| `timeline` | text | immediate / 3_months / 6_months / 12_months / unknown |
| `summary` | text | 1-2 line AI summary |
| `stage` | text | default: 'new' |
| `last_contact_at` | timestamptz | updated on every call |
| `created_at` | timestamptz | immutable |

### `timeline_events` table

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | auto-generated |
| `lead_phone` | text FK | references leads.phone |
| `channel` | text | 'call' or 'whatsapp' |
| `direction` | text | 'inbound' or 'outbound' |
| `duration_sec` | integer | call duration in seconds |
| `transcript` | text | full Sarvam transcript |
| `extracted_fields` | jsonb | raw GPT-4o output |
| `intent_tag` | text | shorthand intent label |
| `created_at` | timestamptz | event timestamp |

Index: `(lead_phone, created_at DESC)` for fast per-lead history queries.

---

## How the Pipeline Works

### Webhook (`/app/api/webhooks/exotel/route.ts`)

1. Receives `POST application/x-www-form-urlencoded` from Exotel
2. Validates required fields: `CallSid`, `From`, `Status`
3. Skips non-terminal statuses (only processes: completed, busy, no-answer, failed)
4. Enqueues a BullMQ job with `jobId = callSid` (idempotent — duplicate webhooks are safe)
5. Returns `200 OK` within ~50ms

### Worker (`/lib/workers/callWorker.ts`)

Runs as a separate Node.js process. For each job:

**Step 1 — Recording URL**
- If Exotel sent `RecordingUrl` in the webhook body → use it directly
- Otherwise → call `GET /v1/Accounts/{sid}/Calls/{callSid}.json` on Exotel REST API
- If recording isn't ready yet → throw error → BullMQ retries (5 attempts, exponential backoff starting at 3s)

**Step 2 — Transcription (Sarvam AI)**
- Downloads audio from Exotel recording URL (authenticated with Basic Auth)
- Sends as `multipart/form-data` to `https://api.sarvam.ai/speech-to-text`
- Model: `saarika:v2`, language: `hi-IN` (auto-detects Hindi/English mix)
- Returns full transcript text

**Step 3 — Field Extraction (GPT-4o)**
- Sends transcript to GPT-4o at temperature 0
- Uses `response_format: { type: "json_object" }` for guaranteed JSON
- Extracts: name, budget range, location, BHK, intent, timeline, summary
- Any unmentioned fields are `null`

**Step 4 — Supabase Upsert**
- Upserts `leads` row on conflict with `phone` (only updates non-null fields)
- Inserts `timeline_events` row with full transcript + extracted fields

### Retry Logic

BullMQ is configured with:
- `attempts: 5`
- `backoff: exponential, starting at 3000ms`
- Retry schedule: 3s → 6s → 12s → 24s → 48s

This handles the common case where Exotel fires the webhook before the
recording file is available on their servers.

---

## Exotel Webhook Configuration

In your Exotel dashboard:
1. Go to **My Apps → your app → Settings**
2. Set **Call Status Callback URL** to:
   - Local dev: use [ngrok](https://ngrok.com) → `https://your-id.ngrok.io/api/webhooks/exotel`
   - Production: `https://your-domain.vercel.app/api/webhooks/exotel`
3. Method: **POST**
4. Exotel sends `application/x-www-form-urlencoded`

Key fields Exotel sends:
```
CallSid        — unique call identifier
From           — caller phone number (e.g. +919876543210)
To             — broker's Exotel number
Status         — completed | busy | no-answer | failed | in-progress
Direction      — inbound | outbound-dial
Duration       — seconds
RecordingUrl   — may be empty immediately after call ends
```

---

## Deployment

### Next.js (Vercel)

Deploy normally. The webhook endpoint runs as a serverless function.

```bash
vercel deploy
```

### Worker Process

The BullMQ worker is a long-running Node.js process. It cannot run on Vercel.
Options:
1. **Railway** (recommended): Create a new service, point to `scripts/startWorker.ts`, set all env vars
2. **Render**: Web Service with `npm run worker` as start command
3. **Fly.io**: Deploy as a separate app
4. **EC2/GCE VM**: Run with PM2: `pm2 start npm -- run worker`

The worker and the Next.js app share the same Upstash Redis queue.
They do NOT need to be on the same server.

---

## Testing Locally

### Option A: ngrok + real Exotel call

```bash
# Terminal 1
npm run dev

# Terminal 2
ngrok http 3000

# Terminal 3
npm run worker

# Configure Exotel webhook to your ngrok URL, make a call
```

### Option B: Simulate webhook manually

```bash
curl -X POST http://localhost:3000/api/webhooks/exotel \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "CallSid=TEST123&From=%2B919876543210&To=%2B912244556677&Status=completed&Direction=inbound&Duration=45&RecordingUrl=https://example.com/test.mp3"
```

Then check BullMQ picked it up (watch worker terminal logs).

### Option C: Test individual services

```typescript
// Test Sarvam transcription
import { transcribeAudioUrl } from "./lib/services/sarvam";
const result = await transcribeAudioUrl("https://your-recording-url.mp3");
console.log(result.transcript);

// Test GPT-4o extraction
import { extractLeadFields } from "./lib/services/extractLeadFields";
const fields = await extractLeadFields("Hi, I am Rahul. I want 2BHK in Andheri, budget 80 to 1 crore.");
console.log(fields);
```

---

## Common Errors and Fixes

| Error | Cause | Fix |
|---|---|---|
| `UPSTASH_REDIS_URL is not set` | Wrong env var name | Use `UPSTASH_REDIS_URL` with `rediss://` format |
| `Recording URL not yet available` | Exotel hasn't processed recording | Expected — BullMQ will retry automatically |
| `Supabase Lead upsert failed` | Schema mismatch or RLS blocking | Run migration, check service role key is set |
| `Sarvam 401` | Wrong API key | Check `SARVAM_API_KEY` in .env.local |
| `GPT-4o returned empty content` | Token limit hit | Truncate very long transcripts before sending |
| Worker not picking up jobs | Worker not running | Start `npm run worker` in separate terminal |
| `maxRetriesPerRequest` error | ioredis config missing | Already fixed in callQueue.ts — don't remove that option |

---

## What to Build Next (Future Features)

### Feature 2: WhatsApp Intelligence
- Receive WhatsApp messages via Interakt/Wati webhook at `POST /api/webhooks/whatsapp`
- Extract lead fields from text messages (no transcription needed)
- Same Supabase upsert pipeline
- Add `channel: 'whatsapp'` to timeline_events

### Feature 3: Lead Dashboard (Next.js UI)
- `/app/dashboard/page.tsx` — table of all leads with filters
- `/app/leads/[phone]/page.tsx` — per-lead timeline view
- Supabase Realtime for live updates when new calls come in

### Feature 4: Follow-up Queue
- After each call, GPT-4o suggests a follow-up action
- Insert into a `follow_ups` table with due_date
- BullMQ scheduled jobs to send WhatsApp reminders via Interakt

### Feature 5: Broker Performance Analytics
- Track calls per broker, conversion rates, avg budget
- Aggregate queries on timeline_events grouped by broker number

### Feature 6: Audio Archival (Cloudflare R2)
- After transcription, download recording and upload to R2
- Store R2 URL in timeline_events for playback in dashboard
- Env vars already defined in .env.example

---

## Third-Party Service Links

| Service | Dashboard | Docs |
|---|---|---|
| Exotel | https://my.exotel.com | https://developer.exotel.com/api |
| Sarvam AI | https://dashboard.sarvam.ai | https://docs.sarvam.ai |
| OpenAI | https://platform.openai.com | https://platform.openai.com/docs |
| Upstash | https://console.upstash.com | https://docs.upstash.com/redis |
| Supabase | https://supabase.com/dashboard | https://supabase.com/docs |
| Vercel | https://vercel.com/dashboard | https://vercel.com/docs |
| Railway (worker) | https://railway.app | https://docs.railway.app |

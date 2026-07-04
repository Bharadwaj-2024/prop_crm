# CLAUDE.md — Feature 2: WhatsApp Intelligence
## Call-Centric AI CRM for Indian Real Estate Brokers

---

## Project Context

This is a Next.js 14 App Router CRM application for Indian real estate brokers.
Feature 1 (Call Intelligence Core) is already built and working.

### Existing Stack
- Next.js 14 (App Router)
- Supabase (Postgres) 
- BullMQ + Upstash Redis (async job queue)
- Groq API (Whisper for transcription + LLama for extraction)
- Cloudflare R2 (optional)
- Vercel (deployment)

### Existing File Structure
```
/app/api/webhooks/exotel/route.ts     ← ALREADY BUILT (do not touch)
/app/dashboard/page.tsx               ← ALREADY BUILT (extend only)
/lib/queues/callQueue.ts              ← ALREADY BUILT (reuse)
/lib/workers/callWorker.ts            ← ALREADY BUILT (do not touch)
/lib/services/sarvam.ts               ← ALREADY BUILT (do not touch)
/lib/services/extractLeadFields.ts    ← ALREADY BUILT (reuse interface)
/lib/supabase/upsertLead.ts           ← ALREADY BUILT (reuse)
/supabase/migrations/001_init.sql     ← ALREADY BUILT (do not touch)
```

### Existing Supabase Schema
```sql
-- leads table (ALREADY EXISTS)
leads: id, phone, name, budget_min, budget_max, location, 
       bhk, intent, timeline, summary, stage, 
       last_contact_at, created_at

-- timeline_events table (ALREADY EXISTS)  
timeline_events: id, lead_phone, channel, direction,
                 duration_sec, transcript, extracted_fields,
                 intent_tag, created_at
```

### Existing Environment Variables
```
EXOTEL_API_KEY, EXOTEL_API_TOKEN, EXOTEL_SID
SARVAM_API_KEY
GROQ_API_KEY
UPSTASH_REDIS_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

---

## Feature 2: WhatsApp Intelligence

### Goal
Automatically capture WhatsApp messages from property buyers,
extract lead information using AI, and display everything in
the existing dashboard alongside call data.

### WhatsApp Provider
Use **Meta WhatsApp Cloud API** (free tier).
- Free: 1000 conversations/month
- No monthly subscription
- Direct from Meta

---

## New Files to Create

```
/app/api/webhooks/whatsapp/route.ts        ← WhatsApp webhook (GET verify + POST messages)
/lib/queues/whatsappQueue.ts               ← BullMQ queue for WhatsApp jobs
/lib/workers/whatsappWorker.ts             ← Job processor
/lib/services/extractFromText.ts           ← Groq LLama text extraction
/lib/services/whatsapp.ts                  ← WhatsApp API client (send messages)
/supabase/migrations/002_whatsapp.sql      ← New columns + whatsapp_messages table
/scripts/startWhatsappWorker.ts            ← Worker entry point
/app/api/whatsapp/send/route.ts            ← API to send WhatsApp reply from dashboard
```

---

## Detailed Implementation

### 1. Supabase Migration (002_whatsapp.sql)

```sql
-- New table for raw WhatsApp messages
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wamid           text UNIQUE NOT NULL,  -- WhatsApp message ID
  from_phone      text NOT NULL,
  to_phone        text NOT NULL,
  message_type    text NOT NULL,         -- text | image | audio | document
  message_body    text,                  -- text content
  media_id        text,                  -- for media messages
  media_url       text,                  -- downloaded media URL
  timestamp       timestamptz NOT NULL,
  processed       boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);

-- Add WhatsApp fields to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp_phone text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp_opted_in boolean DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_whatsapp_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS preferred_channel text DEFAULT 'call';

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_from 
  ON whatsapp_messages (from_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_wamid 
  ON whatsapp_messages (wamid);
```

---

### 2. WhatsApp Webhook (/app/api/webhooks/whatsapp/route.ts)

Meta sends:
- GET request to verify webhook (one time setup)
- POST request for every incoming message

```typescript
// GET — webhook verification
// Meta sends: ?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE
// Must return hub.challenge as plain text

// POST — incoming messages
// Body structure:
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "id": "wamid.xxx",           // unique message ID
          "from": "919876543210",      // sender phone (no +)
          "timestamp": "1234567890",
          "type": "text",
          "text": { "body": "Hi I want 2BHK in Whitefield budget 80 lakhs" }
        }],
        "contacts": [{
          "profile": { "name": "Rahul Sharma" },
          "wa_id": "919876543210"
        }]
      }
    }]
  }]
}

Requirements:
- Return 200 OK immediately (within 5 seconds)
- Deduplicate messages using wamid (WhatsApp message ID)
- Store raw message in whatsapp_messages table
- Enqueue BullMQ job for processing
- Handle message types: text, image, audio, document
- For audio messages: download and transcribe via Groq Whisper
- Skip: status updates (delivered, read receipts)
```

**Environment variables needed:**
```
WHATSAPP_VERIFY_TOKEN=your_custom_verify_token    # you choose this
WHATSAPP_ACCESS_TOKEN=your_meta_access_token      # from Meta dashboard
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id     # from Meta dashboard
WHATSAPP_BUSINESS_ACCOUNT_ID=your_waba_id         # from Meta dashboard
```

---

### 3. WhatsApp Queue (/lib/queues/whatsappQueue.ts)

```typescript
// Same pattern as callQueue.ts
// Queue name: "whatsapp-processing"
// Job payload:
interface WhatsAppJobPayload {
  wamid: string;           // WhatsApp message ID
  fromPhone: string;       // sender: "919876543210"
  senderName: string;      // from contacts[].profile.name
  messageType: string;     // text | audio | image | document
  messageBody: string;     // text content (if text message)
  mediaId?: string;        // if audio/image/document
  timestamp: string;       // ISO timestamp
}

// Job options:
// attempts: 3
// backoff: exponential, 2000ms
```

---

### 4. Text Extraction (/lib/services/extractFromText.ts)

```typescript
// Uses Groq LLama (same as extractLeadFields.ts)
// But input is raw WhatsApp text (not a call transcript)
// Returns same ExtractedLeadFields interface

// System prompt:
const SYSTEM_PROMPT = `You are a real estate lead extraction assistant. 
Extract structured data from WhatsApp messages sent by Indian property buyers to brokers.
Messages may be in Hindi, English, or Hinglish.
Respond ONLY with valid JSON, no explanation, no markdown.`

// User prompt:
`Extract from this WhatsApp message. Set null if not mentioned.
Fields: name, budget_min_lakhs, budget_max_lakhs, location, bhk,
intent (serious_buyer|just_browsing|investor),
timeline (immediate|3_months|6_months|12_months|unknown),
summary (1 sentence)

Sender name from WhatsApp: ${senderName}
Message: ${messageBody}`

// Model: llama-3.3-70b-versatile
// Temperature: 0
// response_format: { type: "json_object" }
```

---

### 5. WhatsApp Worker (/lib/workers/whatsappWorker.ts)

```typescript
// Processing pipeline for each WhatsApp job:

async function processWhatsAppJob(job) {
  const { wamid, fromPhone, senderName, messageType, messageBody, mediaId } = job.data;
  
  // Step 1: Check if already processed (idempotency)
  // Query whatsapp_messages where wamid = ? and processed = true
  // If already processed, skip
  
  // Step 2: Handle different message types
  let textContent = messageBody;
  
  if (messageType === "audio") {
    // Download audio from Meta using mediaId
    // GET https://graph.facebook.com/v18.0/{mediaId}
    // Returns { url: "..." } — download from this URL
    // Transcribe using Groq Whisper (same as sarvam.ts pattern)
    textContent = await transcribeWhatsAppAudio(mediaId);
  }
  
  if (messageType === "image" || messageType === "document") {
    // For now: just note that media was received
    textContent = `[${messageType} received] ${messageBody || ""}`;
  }
  
  // Step 3: Extract lead fields from text
  const fields = await extractFromText(textContent, senderName);
  
  // Step 4: Format phone number
  // WhatsApp sends: "919876543210" → add "+" → "+919876543210"
  const phone = `+${fromPhone}`;
  
  // Step 5: Upsert lead (reuse existing upsertLeadAndEvent)
  await upsertLeadAndEvent({
    phone,
    fields: {
      ...fields,
      name: fields.name ?? senderName ?? null,
    },
    direction: "inbound",
    durationSec: 0,
    transcript: textContent,
    intentTag: fields.intent ?? null,
    channel: "whatsapp",  // add channel parameter
  });
  
  // Step 6: Mark message as processed
  // UPDATE whatsapp_messages SET processed = true WHERE wamid = ?
  
  // Step 7: Send auto-reply via WhatsApp
  await sendWhatsAppReply(fromPhone, fields);
  
  console.log(`[whatsapp-worker] ✅ Processed message ${wamid} from ${phone}`);
}
```

---

### 6. WhatsApp Service (/lib/services/whatsapp.ts)

```typescript
// WhatsApp Cloud API client

const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

// Send text message
async function sendWhatsAppMessage(to: string, message: string): Promise<void>

// Send auto-reply after receiving a message
async function sendWhatsAppReply(to: string, fields: ExtractedLeadFields): Promise<void> {
  // Generate personalized reply based on extracted fields
  // Example:
  // "Hi Rahul! Thanks for reaching out. I understand you're looking for a 
  //  2BHK in Whitefield with a budget of ₹80L. I'll share some great 
  //  options shortly! 🏠"
  
  // If no fields extracted:
  // "Hi! Thanks for your message. I'll get back to you shortly with 
  //  property options. Could you share your budget and preferred area? 🏠"
}

// Send property details
async function sendPropertyDetails(to: string, properties: Property[]): Promise<void>

// Download media from WhatsApp
async function downloadWhatsAppMedia(mediaId: string): Promise<ArrayBuffer>
```

Auto-reply template:
```
Hi {name}! 👋

Thanks for reaching out to us.

{if budget} Budget noted: ₹{min}–{max} Lakhs
{if location} Area: {location}  
{if bhk} Looking for: {bhk}

I'll share the best matching properties shortly! 

Our team will call you within 2 hours. 🏠

— Your Property Advisor
```

---

### 7. Send Reply API (/app/api/whatsapp/send/route.ts)

```typescript
// POST endpoint to send WhatsApp message from dashboard
// Body: { phone: "+919876543210", message: "Hi Rahul, I have 3 options for you..." }
// Used by: "Reply on WhatsApp" button in dashboard lead modal
```

---

### 8. Update upsertLead.ts

```typescript
// Add optional channel parameter to UpsertLeadInput:
interface UpsertLeadInput {
  phone: string;
  fields: ExtractedLeadFields;
  direction: "inbound" | "outbound";
  durationSec: number;
  transcript: string;
  intentTag: string | null;
  channel?: "call" | "whatsapp";  // ← ADD THIS (default: "call")
}

// Update last_whatsapp_at when channel is whatsapp
// Update preferred_channel based on most recent interaction
```

---

### 9. Dashboard Updates (/app/dashboard/page.tsx)

Add to the existing dashboard:

**Stats cards — add:**
- WhatsApp Leads today (green with WhatsApp icon)

**Table — add column:**
- Channel icons: 📞 for call, 💬 for WhatsApp
- Show last interaction channel

**Lead Detail Modal — update timeline:**
- Show WhatsApp messages with 💬 icon
- Show message body in timeline
- Add "Reply on WhatsApp" button → opens compose box
- Green background for WhatsApp events vs blue for calls

**Filter — add:**
- Channel filter: All / Calls / WhatsApp

---

### 10. Worker Entry Point (/scripts/startWhatsappWorker.ts)

```typescript
// Same pattern as startWorker.ts
// Can run both workers in same process:
import { startCallWorker } from "../lib/workers/callWorker";
import { startWhatsAppWorker } from "../lib/workers/whatsappWorker";

startCallWorker();
startWhatsAppWorker();
```

Update package.json:
```json
"worker": "ts-node --project tsconfig.server.json scripts/startWorker.ts",
"worker:whatsapp": "ts-node --project tsconfig.server.json scripts/startWhatsappWorker.ts",
"worker:all": "ts-node --project tsconfig.server.json scripts/startAllWorkers.ts"
```

---

## New Environment Variables

Add to .env.local:
```
# Meta WhatsApp Cloud API
WHATSAPP_VERIFY_TOKEN=my_crm_verify_token_2024    # you choose any string
WHATSAPP_ACCESS_TOKEN=EAAxxxxxx                    # from Meta for Developers
WHATSAPP_PHONE_NUMBER_ID=123456789                 # from Meta for Developers  
WHATSAPP_BUSINESS_ACCOUNT_ID=987654321             # from Meta for Developers
```

---

## Meta WhatsApp Cloud API Setup Guide

### Step 1 — Create Meta App
1. Go to https://developers.facebook.com
2. Click "Create App"
3. Select "Business" type
4. Name: "Real Estate CRM"

### Step 2 — Add WhatsApp Product
1. In app dashboard → Add Product → WhatsApp
2. Click "WhatsApp" → Setup
3. Note down:
   - Phone Number ID
   - WhatsApp Business Account ID
   - Generate Permanent Access Token

### Step 3 — Configure Webhook
1. WhatsApp → Configuration → Webhook
2. Callback URL: `https://your-domain.com/api/webhooks/whatsapp`
3. Verify Token: same as WHATSAPP_VERIFY_TOKEN in .env
4. Subscribe to: messages

### Step 4 — Add Test Phone Number
1. WhatsApp → API Setup
2. Add your mobile number as test recipient
3. Send test message to verify

---

## Testing

### Test webhook verification:
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=my_crm_verify_token_2024&hub.challenge=CHALLENGE123" -Method GET
# Should return: CHALLENGE123
```

### Test incoming message:
```powershell
$body = '{"object":"whatsapp_business_account","entry":[{"changes":[{"value":{"messages":[{"id":"wamid.test001","from":"919876543210","timestamp":"1718000000","type":"text","text":{"body":"Hi I am Rahul looking for 2BHK in Indiranagar budget 70 to 90 lakhs need in 3 months"}}],"contacts":[{"profile":{"name":"Rahul Sharma"},"wa_id":"919876543210"}]}}]}]}'

Invoke-WebRequest -Uri "http://localhost:3000/api/webhooks/whatsapp" -Method POST -ContentType "application/json" -Body $body
```

### Expected Terminal 2 output:
```
[whatsapp-worker] Processing message wamid.test001 from +919876543210
[extract] Sending to Groq LLama...
[extract] Extracted: { name: 'Rahul Sharma', intent: 'serious_buyer', location: 'Indiranagar' }
[supabase] Lead upserted for phone: +919876543210
[whatsapp] Auto-reply sent to 919876543210
[whatsapp-worker] ✅ Complete
```

---

## Implementation Order

Build in this exact order:

1. `supabase/migrations/002_whatsapp.sql` — run in Supabase SQL editor
2. `lib/queues/whatsappQueue.ts` — queue definition
3. `lib/services/extractFromText.ts` — text extraction
4. `lib/services/whatsapp.ts` — WhatsApp API client
5. `app/api/webhooks/whatsapp/route.ts` — webhook receiver
6. `lib/workers/whatsappWorker.ts` — job processor
7. `lib/supabase/upsertLead.ts` — update to support channel param
8. `app/api/whatsapp/send/route.ts` — send reply API
9. `scripts/startWhatsappWorker.ts` — worker entry
10. `app/dashboard/page.tsx` — update dashboard UI

---

## Code Quality Requirements

- TypeScript strict mode
- All async functions wrapped in try/catch
- Console logs with context: `[whatsapp-worker]`, `[whatsapp-service]`
- No placeholder code — complete working implementation
- Reuse existing patterns from Feature 1
- BullMQ job IDs must be idempotent (use wamid as jobId)
- Return 200 from webhook within 3 seconds always
- Handle duplicate webhooks gracefully (Meta may retry)

---

## Definition of Done

Feature 2 is complete when:
- [ ] WhatsApp message received → lead appears in Supabase leads table
- [ ] Timeline event created with channel='whatsapp'
- [ ] Auto-reply sent back to buyer on WhatsApp
- [ ] Dashboard shows 💬 WhatsApp events in lead timeline
- [ ] "Reply on WhatsApp" button works from dashboard
- [ ] Both call and WhatsApp leads visible in same table
- [ ] Channel filter works on dashboard
- [ ] All tests pass (manual test with curl/PowerShell)

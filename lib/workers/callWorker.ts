/**
 * /lib/workers/callWorker.ts
 *
 * BullMQ worker that processes each call job:
 *   1. Fetches recording URL from Exotel (if not in payload)
 *   2. Transcribes audio via Sarvam AI
 *   3. Extracts lead fields via GPT-4o
 *   4. Upserts lead + inserts timeline event in Supabase
 *
 * Run this file as a long-lived Node.js process (NOT inside Next.js).
 * See: scripts/startWorker.ts  or  `node -r ts-node/register lib/workers/callWorker.ts`
 */

import "dotenv/config"; // loads .env.local when run standalone
import { Worker, Job } from "bullmq";
import { CALL_QUEUE_NAME, redisConnection, CallJobPayload } from "@/lib/queues/callQueue";
import { transcribeAudioUrl } from "@/lib/services/sarvam";
import { extractLeadFields } from "@/lib/services/extractLeadFields";
import { scheduleFollowUps } from "@/lib/services/scheduleFollowUps";
import { upsertLeadAndEvent } from "@/lib/supabase/upsertLead";

// ----------------------------------------------------------------
// Exotel: fetch recording URL if not provided in webhook payload
// ----------------------------------------------------------------
async function fetchRecordingUrl(callSid: string): Promise<string> {
  const apiKey   = process.env.EXOTEL_API_KEY!;
  const apiToken = process.env.EXOTEL_API_TOKEN!;
  const sid      = process.env.EXOTEL_SID!;

  // Exotel REST API endpoint for call details
  const url = `https://api.exotel.com/v1/Accounts/${sid}/Calls/${callSid}.json`;

  const res = await fetch(url, {
    headers: {
      Authorization:
        "Basic " + Buffer.from(`${apiKey}:${apiToken}`).toString("base64"),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `[worker] Exotel call fetch failed (${res.status}) for ${callSid}: ${body}`
    );
  }

  const data = await res.json();
  const recordingUrl: string | undefined =
    data?.Call?.RecordingUrl ?? data?.recording_url;

  if (!recordingUrl) {
    // Recording may not be ready yet — BullMQ will retry with exponential backoff
    throw new Error(
      `[worker] Recording URL not yet available for ${callSid}. Will retry.`
    );
  }

  return recordingUrl;
}

// ----------------------------------------------------------------
// Main job processor
// ----------------------------------------------------------------
async function processCallJob(job: Job<CallJobPayload>): Promise<void> {
  const { callSid, from, direction, durationSec, recordingUrl: payloadUrl } =
    job.data;

  console.log(
    `[worker] Processing job ${job.id} | callSid=${callSid} | from=${from} | attempt=${job.attemptsMade + 1}`
  );

  // Step 1 — get recording URL
  let recordingUrl = payloadUrl;
  if (!recordingUrl) {
    console.log(`[worker] No recording URL in payload. Fetching from Exotel...`);
    recordingUrl = await fetchRecordingUrl(callSid);
  }
  console.log(`[worker] Recording URL: ${recordingUrl}`);

  // Step 2 — transcribe
  const { transcript, language_code } = await transcribeAudioUrl(recordingUrl);
  console.log(
    `[worker] Transcript (${language_code}): ${transcript.slice(0, 120)}...`
  );

  // Step 3 — extract lead fields
  const fields = await extractLeadFields(transcript);

  // Step 4 — upsert lead + timeline event
  await upsertLeadAndEvent({
    phone: from,
    fields,
    direction,
    durationSec,
    transcript,
    intentTag: fields.intent ?? null,
  });

  await scheduleFollowUps(from, fields);

  console.log(`[worker] ✅ Job ${job.id} complete for ${from}`);
}

// ----------------------------------------------------------------
// Worker registration
// ----------------------------------------------------------------
export function startCallWorker() {
  const worker = new Worker<CallJobPayload>(
    CALL_QUEUE_NAME,
    processCallJob,
    {
      connection: redisConnection,
      concurrency: 5, // process up to 5 calls in parallel
    }
  );

  worker.on("completed", (job) => {
    console.log(`[worker] ✅ Completed: ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[worker] ❌ Failed: ${job?.id} | attempt ${job?.attemptsMade} | error: ${err.message}`
    );
  });

  worker.on("error", (err) => {
    console.error("[worker] Worker error:", err);
  });

  console.log(`[worker] 🚀 Call worker started. Listening on queue: ${CALL_QUEUE_NAME}`);
  return worker;
}

// Allow running directly: ts-node lib/workers/callWorker.ts
if (require.main === module) {
  startCallWorker();
}

import "dotenv/config";
import { Worker, Job } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import { CALL_QUEUE_NAME, redisConnection, CallJobPayload } from "@/lib/queues/callQueue";
import { transcribeAudioUrl } from "@/lib/services/sarvam";
import { extractLeadFields, ExtractedLeadFields } from "@/lib/services/extractLeadFields";
import { upsertLeadAndEvent } from "@/lib/supabase/upsertLead";
import { sendWhatsAppMessage } from "@/lib/services/whatsapp";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ----------------------------------------------------------------
// Schedule follow-up WhatsApp messages after call
// ----------------------------------------------------------------
async function scheduleFollowUps(
  leadPhone: string,
  fields: ExtractedLeadFields
): Promise<void> {
  const supabase = getSupabase();

  const name     = fields.name     ?? "there";
  const location = fields.location ?? "your preferred area";
  const bhk      = fields.bhk      ?? "property";
  const budget   = fields.budget_min_lakhs
    ? `₹${fields.budget_min_lakhs}-${fields.budget_max_lakhs}L`
    : "your budget";

  const messages = [
    {
      day: 0,
      message: `Hi ${name}! 👋 Thanks for calling us about ${bhk} in ${location}. I'll share the best matching properties shortly! 🏠`,
    },
    {
      day: 1,
      message: `Hi ${name}! Following up on your search for ${bhk} in ${location} within ${budget}. I have 3 excellent options ready. When can we schedule a site visit? 🏠`,
    },
    {
      day: 3,
      message: `Hi ${name}! Still looking for ${bhk} in ${location}? We have new listings within ${budget}. Reply to see options! 🏡`,
    },
    {
      day: 7,
      message: `Hi ${name}! Properties in ${location} are selling fast. Don't miss out — reply YES to see latest options in ${budget}. 🔥`,
    },
    {
      day: 14,
      message: `Hi ${name}! Final follow up — we have an exclusive ${bhk} in ${location} within ${budget}. Interested? Reply now! 🏠`,
    },
  ];

  const now = new Date();
  const rows = messages.map((m) => ({
    lead_phone:   leadPhone,
    message:      m.message,
    scheduled_at: new Date(now.getTime() + m.day * 24 * 60 * 60 * 1000).toISOString(),
    follow_up_day: m.day,
    status:       "pending",
  }));

  // Send day 0 message immediately via WhatsApp
  try {
    await sendWhatsAppMessage(leadPhone, messages[0].message);
    console.log(`[follow-up] ✅ Immediate message sent to ${leadPhone}`);
    rows[0].status = "sent";
  } catch (err) {
    console.error(`[follow-up] ❌ Failed to send immediate message:`, err);
  }

  // Save all follow-ups to database
  const { error } = await supabase.from("follow_ups").insert(rows);
  if (error) {
    console.error("[follow-up] Failed to schedule:", error.message);
  } else {
    console.log(`[follow-up] ✅ Scheduled ${rows.length} messages for ${leadPhone}`);
  }
}

// ----------------------------------------------------------------
// Fetch recording URL from Exotel
// ----------------------------------------------------------------
async function fetchRecordingUrl(callSid: string): Promise<string> {
  const apiKey   = process.env.EXOTEL_API_KEY!;
  const apiToken = process.env.EXOTEL_API_TOKEN!;
  const sid      = process.env.EXOTEL_SID!;

  const url = `https://api.exotel.com/v1/Accounts/${sid}/Calls/${callSid}.json`;

  const res = await fetch(url, {
    headers: {
      Authorization: "Basic " + Buffer.from(`${apiKey}:${apiToken}`).toString("base64"),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`[worker] Exotel call fetch failed (${res.status}) for ${callSid}: ${body}`);
  }

  const data = await res.json();
  const recordingUrl: string | undefined =
    data?.Call?.RecordingUrl ?? data?.recording_url;

  if (!recordingUrl) {
    throw new Error(`[worker] Recording URL not yet available for ${callSid}. Will retry.`);
  }

  return recordingUrl;
}

// ----------------------------------------------------------------
// Main job processor
// ----------------------------------------------------------------
async function processCallJob(job: Job<CallJobPayload>): Promise<void> {
  const { callSid, from, direction, durationSec, recordingUrl: payloadUrl } = job.data;

  console.log(`[worker] Processing job ${job.id} | callSid=${callSid} | from=${from} | attempt=${job.attemptsMade + 1}`);

  // Step 1 — get recording URL
  let recordingUrl = payloadUrl;
  if (!recordingUrl) {
    console.log(`[worker] No recording URL in payload. Fetching from Exotel...`);
    recordingUrl = await fetchRecordingUrl(callSid);
  }
  console.log(`[worker] Recording URL: ${recordingUrl}`);

  // Step 2 — transcribe
  const { transcript, language_code } = await transcribeAudioUrl(recordingUrl);
  console.log(`[worker] Transcript (${language_code}): ${transcript.slice(0, 120)}...`);

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

  // Step 5 — schedule WhatsApp follow-ups
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
      connection: redisConnection as any,
      concurrency: 5,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[worker] ✅ Completed: ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[worker] ❌ Failed: ${job?.id} | attempt ${job?.attemptsMade} | error: ${err.message}`);
  });

  worker.on("error", (err) => {
    console.error("[worker] Worker error:", err);
  });

  console.log(`[worker] 🚀 Call worker started. Listening on queue: ${CALL_QUEUE_NAME}`);
  return worker;
}

if (require.main === module) {
  startCallWorker();
}
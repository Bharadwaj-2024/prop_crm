import "dotenv/config";
import { Worker, Job } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import { WHATSAPP_QUEUE_NAME, WhatsAppJobPayload } from "@/lib/queues/whatsappQueue";
import { redisConnection } from "@/lib/queues/callQueue";
import { extractFromText } from "@/lib/services/extractFromText";
import { upsertLeadAndEvent } from "@/lib/supabase/upsertLead";
import { sendWhatsAppReply, downloadWhatsAppMedia } from "@/lib/services/whatsapp";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

async function transcribeWhatsAppAudio(mediaId: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  const audioBuffer = await downloadWhatsAppMedia(mediaId);

  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: "audio/ogg" });
  formData.append("file", blob, "audio.ogg");
  formData.append("model", "whisper-large-v3");
  formData.append("response_format", "text");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[whatsapp-worker] Whisper transcription failed (${res.status}): ${err}`);
  }

  const transcript = await res.text();
  console.log(`[whatsapp-worker] Transcribed audio: ${transcript.slice(0, 100)}...`);
  return transcript;
}

async function processWhatsAppJob(job: Job<WhatsAppJobPayload>): Promise<void> {
  const { wamid, fromPhone, senderName, messageType, messageBody, mediaId } = job.data;

  console.log(`[whatsapp-worker] Processing message ${wamid} from ${fromPhone} | attempt=${job.attemptsMade + 1}`);

  const supabase = getSupabase();

  // Step 1: Check idempotency
  const { data: existing } = await supabase
    .from("whatsapp_messages")
    .select("processed")
    .eq("wamid", wamid)
    .single();

  if (existing?.processed) {
    console.log(`[whatsapp-worker] Already processed ${wamid}, skipping`);
    return;
  }

  // Step 2: Resolve text content
  let textContent = messageBody;

  if (messageType === "audio" && mediaId) {
    console.log(`[whatsapp-worker] Transcribing audio ${mediaId}...`);
    textContent = await transcribeWhatsAppAudio(mediaId);
  } else if (messageType === "image" || messageType === "document") {
    textContent = `[${messageType} received] ${messageBody ?? ""}`.trim();
  }

  if (!textContent) {
    console.log(`[whatsapp-worker] No text content for ${wamid}, skipping extraction`);
    textContent = `[${messageType} received]`;
  }

  // Step 3: Extract lead fields
  const fields = await extractFromText(textContent, senderName);

  // Step 4: Format phone number (WhatsApp sends without +)
  const phone = `+${fromPhone}`;

  // Step 5: Upsert lead and timeline event
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
    channel: "whatsapp",
  });

  // Step 6: Mark message as processed
  const { error: updateError } = await supabase
    .from("whatsapp_messages")
    .update({ processed: true })
    .eq("wamid", wamid);

  if (updateError) {
    console.error(`[whatsapp-worker] Failed to mark ${wamid} as processed:`, updateError.message);
  }

  // Step 7: Send auto-reply
  try {
    await sendWhatsAppReply(fromPhone, fields);
    console.log(`[whatsapp-worker] Auto-reply sent to ${fromPhone}`);
  } catch (replyErr) {
    // Non-fatal — lead is saved regardless
    console.error(`[whatsapp-worker] Auto-reply failed for ${fromPhone}:`, replyErr);
  }

  console.log(`[whatsapp-worker] ✅ Processed message ${wamid} from ${phone}`);
}

export function startWhatsAppWorker() {
  const worker = new Worker<WhatsAppJobPayload>(
    WHATSAPP_QUEUE_NAME,
    processWhatsAppJob,
    {
      connection: redisConnection,
      concurrency: 5,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[whatsapp-worker] ✅ Completed: ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[whatsapp-worker] ❌ Failed: ${job?.id} | attempt ${job?.attemptsMade} | error: ${err.message}`
    );
  });

  worker.on("error", (err) => {
    console.error("[whatsapp-worker] Worker error:", err);
  });

  console.log(`[whatsapp-worker] 🚀 WhatsApp worker started. Listening on queue: ${WHATSAPP_QUEUE_NAME}`);
  return worker;
}

if (require.main === module) {
  startWhatsAppWorker();
}

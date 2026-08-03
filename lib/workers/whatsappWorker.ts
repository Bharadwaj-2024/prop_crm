import "dotenv/config";
import { Worker, Job } from "bullmq";
import { createClient } from "@supabase/supabase-js";
import { redisConnection } from "@/lib/queues/callQueue";
import { WHATSAPP_QUEUE_NAME, WhatsAppJobPayload } from "@/lib/queues/whatsappQueue";
import { extractFromText } from "@/lib/services/extractFromText";
import { sendWhatsAppReply } from "@/lib/services/whatsapp";
import { upsertLeadAndEvent } from "@/lib/supabase/upsertLead";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function normalizePhone(phone: string): string {
  return phone.startsWith("+") ? phone : `+${phone}`;
}

async function persistIncomingMessage(job: WhatsAppJobPayload): Promise<boolean> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("whatsapp_messages")
    .select("processed")
    .eq("wamid", job.wamid)
    .maybeSingle();

  if (!error && data?.processed) {
    console.log(`[whatsapp-worker] Message ${job.wamid} already processed. Skipping.`);
    return true;
  }

  if (error && !error.message.includes("relation") && !error.message.includes("does not exist")) {
    throw new Error(`[whatsapp-worker] Failed to check message ${job.wamid}: ${error.message}`);
  }

  const { error: upsertError } = await supabase
    .from("whatsapp_messages")
    .upsert({
      wamid: job.wamid,
      from_phone: normalizePhone(job.fromPhone),
      to_phone: process.env.WHATSAPP_PHONE_NUMBER_ID ?? "unknown",
      message_type: job.messageType,
      message_body: job.messageBody || null,
      media_id: job.mediaId ?? null,
      timestamp: job.timestamp,
      processed: false,
    }, { onConflict: "wamid" });

  if (upsertError) {
    if (upsertError.message.includes("relation") || upsertError.message.includes("does not exist")) {
      console.warn("[whatsapp-worker] whatsapp_messages table is missing; continuing without raw message persistence");
      return false;
    }

    throw new Error(`[whatsapp-worker] Failed to persist message ${job.wamid}: ${upsertError.message}`);
  }

  return false;
}

async function markMessageProcessed(wamid: string): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from("whatsapp_messages")
    .update({ processed: true })
    .eq("wamid", wamid);

  if (error) {
    if (error.message.includes("relation") || error.message.includes("does not exist")) {
      return;
    }

    throw new Error(`[whatsapp-worker] Failed to mark ${wamid} as processed: ${error.message}`);
  }
}

function buildMessageText(job: WhatsAppJobPayload): string {
  const trimmedBody = job.messageBody.trim();
  if (trimmedBody) {
    return trimmedBody;
  }

  if (job.messageType === "audio") {
    return "Customer sent a WhatsApp audio message.";
  }

  if (job.messageType === "image") {
    return "Customer sent a WhatsApp image.";
  }

  if (job.messageType === "document") {
    return "Customer sent a WhatsApp document.";
  }

  return "Customer sent a WhatsApp message.";
}

async function processWhatsAppJob(job: Job<WhatsAppJobPayload>): Promise<void> {
  const alreadyProcessed = await persistIncomingMessage(job.data);
  if (alreadyProcessed) {
    return;
  }

  const fromPhone = normalizePhone(job.data.fromPhone);
  const messageText = buildMessageText(job.data);

  console.log(
    `[whatsapp-worker] Processing message ${job.data.wamid} from ${fromPhone} | attempt=${job.attemptsMade + 1}`
  );

  const fields = await extractFromText(messageText, job.data.senderName);

  await upsertLeadAndEvent({
    phone: fromPhone,
    fields,
    direction: "inbound",
    durationSec: 0,
    transcript: messageText,
    intentTag: fields.intent ?? null,
    channel: "whatsapp",
  });

  const sendResult = await sendWhatsAppReply(job.data.fromPhone, fields);
  if (!sendResult.ok) {
    throw new Error(sendResult.error ?? "Unknown WhatsApp reply error");
  }

  await markMessageProcessed(job.data.wamid);

  console.log(`[whatsapp-worker] Completed message ${job.data.wamid} for ${fromPhone}`);
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
    console.log(`[whatsapp-worker] Completed job ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[whatsapp-worker] Failed job ${job?.id} | attempt ${job?.attemptsMade} | error: ${err.message}`
    );
  });

  worker.on("error", (err) => {
    console.error("[whatsapp-worker] Worker error:", err);
  });

  console.log(`[whatsapp-worker] WhatsApp worker started. Listening on queue: ${WHATSAPP_QUEUE_NAME}`);
  return worker;
}

if (require.main === module) {
  startWhatsAppWorker();
}

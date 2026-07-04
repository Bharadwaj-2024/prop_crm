import { NextRequest, NextResponse } from "next/server";
import { callQueue, CallJobPayload } from "@/lib/queues/callQueue";

export const runtime = "nodejs";

async function handleExotelWebhook(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    let body: Record<string, string> = {};

    // Parse POST body if present
    if (req.method === "POST") {
      const formData = await req.formData();
      formData.forEach((value, key) => { body[key] = value.toString(); });
    }

    // Merge GET params + POST body (GET params take priority for Exotel)
    params.forEach((value, key) => { body[key] = value; });

    const callSid      = body["CallSid"]          ?? "";
    const from         = body["CallFrom"]          ?? body["From"] ?? "";
    const to           = body["CallTo"]            ?? body["To"]   ?? "";
    const status       = body["DialCallStatus"]    ?? body["Status"] ?? "";
    const rawDirection = body["Direction"]         ?? "inbound";
    const recordingUrl = body["RecordingUrl"]      ?? "";
    const durationRaw  = body["DialCallDuration"]  ?? body["Duration"] ?? "0";

    console.log(`[exotel-webhook] Received:`, {
      callSid, from, status, recordingUrl: recordingUrl || "none"
    });

    // Skip if no recording URL and not a terminal status
    const terminalStatuses = ["completed", "busy", "no-answer", "failed", "free"];
    const hasRecording = !!recordingUrl;
    const isTerminal = terminalStatuses.includes(status.toLowerCase());

    if (!hasRecording && !isTerminal) {
      console.log(`[exotel-webhook] Skipping — no recording, status: ${status}`);
      return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
    }

    if (!callSid || !from) {
      console.log(`[exotel-webhook] Skipping — missing callSid or from`);
      return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
    }

    // Only process when we have the recording URL
    if (!hasRecording) {
      console.log(`[exotel-webhook] Skipping — no recording URL yet, status: ${status}`);
      return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
    }

    const cleanFrom = from.startsWith("+") ? from : `+91${from}`;
    const direction: "inbound" | "outbound" =
      rawDirection.toLowerCase().includes("outbound") ? "outbound" : "inbound";

    const payload: CallJobPayload = {
      callSid,
      from: cleanFrom,
      to,
      direction,
      durationSec: parseInt(durationRaw, 10) || 0,
      recordingUrl: recordingUrl, // ← always present now
      webhookReceivedAt: new Date().toISOString(),
    };

    console.log(`[exotel-webhook] ✅ Enqueueing with recording: ${recordingUrl}`);

    const job = await callQueue.add(`call:${callSid}`, payload, {
      jobId: callSid,
    });

    console.log(`[exotel-webhook] ✅ Enqueued job ${job.id} for ${cleanFrom}`);
    return NextResponse.json({ ok: true, jobId: job.id }, { status: 200 });

  } catch (err) {
    console.error("[exotel-webhook] Fatal error", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  return handleExotelWebhook(req);
}

export async function GET(req: NextRequest) {
  return handleExotelWebhook(req);
}
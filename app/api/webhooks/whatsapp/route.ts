import { NextRequest, NextResponse } from "next/server";
import { whatsappQueue } from "@/lib/queues/whatsappQueue";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (
    mode === "subscribe" &&
    token === process.env.WHATSAPP_VERIFY_TOKEN &&
    typeof challenge === "string"
  ) {
    console.log("[whatsapp-webhook] Webhook verified");
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  console.warn("[whatsapp-webhook] Verification failed", { mode, token });
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();

    if (body.object !== "whatsapp_business_account") {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};

        if (value.statuses) {
          continue;
        }

        const messages: any[] = Array.isArray(value.messages) ? value.messages : [];
        const contacts: any[] = Array.isArray(value.contacts) ? value.contacts : [];

        for (const msg of messages) {
          const wamid = typeof msg.id === "string" ? msg.id : undefined;
          const fromPhone = typeof msg.from === "string" ? msg.from : undefined;
          const messageType = typeof msg.type === "string" ? msg.type : undefined;
          const timestampSeconds = Number.parseInt(String(msg.timestamp ?? "0"), 10);
          const timestamp = Number.isFinite(timestampSeconds) && timestampSeconds > 0
            ? new Date(timestampSeconds * 1000).toISOString()
            : new Date().toISOString();

          if (!wamid || !fromPhone || !messageType) {
            console.warn("[whatsapp-webhook] Skipping malformed message", { msg });
            continue;
          }

          const contact = contacts.find((item: any) => item?.wa_id === fromPhone) ?? contacts[0];
          const senderName = contact?.profile?.name ?? "";

          let messageBody = "";
          let mediaId: string | undefined;

          if (messageType === "text") {
            messageBody = msg.text?.body ?? "";
          } else if (messageType === "audio") {
            mediaId = msg.audio?.id;
          } else if (messageType === "image") {
            mediaId = msg.image?.id;
            messageBody = msg.image?.caption ?? "";
          } else if (messageType === "document") {
            mediaId = msg.document?.id;
            messageBody = msg.document?.caption ?? "";
          }

          try {
            await whatsappQueue.add(
              `whatsapp:${wamid}`,
              {
                wamid,
                fromPhone,
                senderName,
                messageType,
                messageBody,
                mediaId,
                timestamp,
              },
              { jobId: wamid }
            );

            console.log(`[whatsapp-webhook] Enqueued job ${wamid} from ${fromPhone}`);
          } catch (queueError) {
            console.error(`[whatsapp-webhook] Failed to enqueue ${wamid}:`, queueError);
          }
        }
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[whatsapp-webhook] Fatal error", err);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
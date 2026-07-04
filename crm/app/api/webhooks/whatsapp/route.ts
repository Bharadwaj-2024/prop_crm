import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { whatsappQueue } from "@/lib/queues/whatsappQueue";

export const runtime = "nodejs";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

// GET — webhook verification (one-time Meta setup)
export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = req.nextUrl.searchParams;
  const mode      = params.get("hub.mode");
  const token     = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === "subscribe" && token === verifyToken && challenge) {
    console.log("[whatsapp-webhook] Webhook verified");
    return new NextResponse(challenge, { status: 200 });
  }

  console.warn("[whatsapp-webhook] Verification failed", { mode, token });
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST — incoming messages from Meta
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();

    // Only handle whatsapp_business_account events
    if (body.object !== "whatsapp_business_account") {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const supabase = getSupabase();

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};

        // Skip status updates (delivered, read receipts)
        if (value.statuses) continue;

        const messages: any[] = value.messages ?? [];
        const contacts: any[] = value.contacts ?? [];

        for (const msg of messages) {
          const wamid       = msg.id as string;
          const fromPhone   = msg.from as string;
          const msgType     = msg.type as string;
          const tsSeconds   = parseInt(msg.timestamp, 10);
          const timestamp   = new Date(tsSeconds * 1000).toISOString();

          // Find sender name from contacts array
          const contact = contacts.find((c: any) => c.wa_id === fromPhone);
          const senderName: string = contact?.profile?.name ?? "";

          // Extract content based on type
          let messageBody = "";
          let mediaId: string | undefined;

          if (msgType === "text") {
            messageBody = msg.text?.body ?? "";
          } else if (msgType === "audio") {
            mediaId = msg.audio?.id;
          } else if (msgType === "image") {
            mediaId = msg.image?.id;
            messageBody = msg.image?.caption ?? "";
          } else if (msgType === "document") {
            mediaId = msg.document?.id;
            messageBody = msg.document?.caption ?? "";
          }

          // Store raw message (UNIQUE on wamid handles duplicates)
          const { error: insertError } = await supabase
            .from("whatsapp_messages")
            .insert({
              wamid,
              from_phone:   fromPhone,
              to_phone:     process.env.WHATSAPP_PHONE_NUMBER_ID ?? "",
              message_type: msgType,
              message_body: messageBody || null,
              media_id:     mediaId ?? null,
              timestamp,
            })
            .select()
            .single();

          if (insertError) {
            // Duplicate wamid — Meta retried, skip
            if (insertError.code === "23505") {
              console.log(`[whatsapp-webhook] Duplicate wamid ${wamid}, skipping`);
              continue;
            }
            console.error(`[whatsapp-webhook] DB insert error for ${wamid}:`, insertError.message);
            continue;
          }

          // Enqueue BullMQ job (wamid as jobId for idempotency)
          await whatsappQueue.add(
            `whatsapp:${wamid}`,
            {
              wamid,
              fromPhone,
              senderName,
              messageType: msgType,
              messageBody,
              mediaId,
              timestamp,
            },
            { jobId: wamid }
          );

          console.log(`[whatsapp-webhook] Enqueued job ${wamid} from ${fromPhone}`);
        }
      }
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[whatsapp-webhook] Fatal error", err);
    // Always return 200 so Meta doesn't retry indefinitely
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

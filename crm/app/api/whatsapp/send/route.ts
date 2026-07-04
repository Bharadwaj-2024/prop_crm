import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppMessage } from "@/lib/services/whatsapp";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { phone, message } = body as { phone?: string; message?: string };

    if (!phone || !message) {
      return NextResponse.json({ error: "phone and message are required" }, { status: 400 });
    }

    // Normalize: strip leading + for WhatsApp API
    const to = phone.startsWith("+") ? phone.slice(1) : phone;

    await sendWhatsAppMessage(to, message);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[whatsapp-send] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

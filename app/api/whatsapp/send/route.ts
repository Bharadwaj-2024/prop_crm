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

    const to = normalizeWhatsAppPhone(phone);
    const result = await sendWhatsAppMessage(to, message);

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error ?? "WhatsApp send failed",
          status: result.status,
          body: result.body,
        },
        { status: result.status ?? 502 }
      );
    }

    return NextResponse.json({ ok: true, to, status: result.status, body: result.body }, { status: 200 });
  } catch (err) {
    console.error("[whatsapp-send] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

function normalizeWhatsAppPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  if (!digits) {
    throw new Error("phone must contain digits");
  }

  if (digits.length === 10) {
    return `91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }

  return digits;
}

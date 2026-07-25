import type { ExtractedLeadFields } from "@/lib/services/extractLeadFields";

const WHATSAPP_API_BASE = "https://graph.facebook.com/v18.0";

export interface WhatsAppSendResult {
  ok: boolean;
  status?: number;
  body?: unknown;
  error?: string;
}

function getPhoneNumberId(): string {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!id) {
    throw new Error("WHATSAPP_PHONE_NUMBER_ID is not set");
  }
  return id;
}

function getAccessToken(): string {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    throw new Error("WHATSAPP_ACCESS_TOKEN is not set");
  }
  return token;
}

export async function sendWhatsAppMessage(to: string, message: string): Promise<WhatsAppSendResult> {
  try {
    const phoneNumberId = getPhoneNumberId();
    const accessToken = getAccessToken();

    const res = await fetch(`${WHATSAPP_API_BASE}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      }),
    });

    const rawText = await res.text();
    const parsedBody = rawText ? safeJsonParse(rawText) : null;

    if (!res.ok) {
      const errorMessage = `[whatsapp-service] Send failed (${res.status}): ${rawText}`;
      console.error(errorMessage);
      return {
        ok: false,
        status: res.status,
        body: parsedBody,
        error: errorMessage,
      };
    }

    console.log(`[whatsapp-service] Message sent to ${to}`);
    return {
      ok: true,
      status: res.status,
      body: parsedBody,
    };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Unknown WhatsApp send error";
    console.error("[whatsapp-service] Unexpected send error:", error);
    return {
      ok: false,
      error: messageText,
    };
  }
}

export async function sendWhatsAppReply(
  to: string,
  fields: ExtractedLeadFields
): Promise<WhatsAppSendResult> {
  let message: string;

  const hasDetails = Boolean(
    fields.budget_min_lakhs || fields.budget_max_lakhs || fields.location || fields.bhk
  );

  if (hasDetails) {
    const lines: string[] = [];
    const name = fields.name ? `Hi ${fields.name}!` : "Hi!";
    lines.push(name);
    lines.push("");
    lines.push("Thanks for reaching out to us.");
    lines.push("");

    if (fields.budget_min_lakhs || fields.budget_max_lakhs) {
      if (fields.budget_min_lakhs && fields.budget_max_lakhs) {
        lines.push(`Budget noted: Rs ${fields.budget_min_lakhs}-${fields.budget_max_lakhs} Lakhs`);
      } else if (fields.budget_min_lakhs) {
        lines.push(`Budget noted: Rs ${fields.budget_min_lakhs}L+`);
      } else {
        lines.push(`Budget noted: Up to Rs ${fields.budget_max_lakhs}L`);
      }
    }

    if (fields.location) {
      lines.push(`Area: ${fields.location}`);
    }

    if (fields.bhk) {
      lines.push(`Looking for: ${fields.bhk}`);
    }

    lines.push("");
    lines.push("I will share the best matching properties shortly.");
    lines.push("");
    lines.push("Our team will call you within 2 hours.");
    lines.push("");
    lines.push("- Your Property Advisor");
    message = lines.join("\n");
  } else {
    const name = fields.name ? `Hi ${fields.name}!` : "Hi!";
    message = `${name} Thanks for your message. I will get back to you shortly with property options. Could you share your budget and preferred area?`;
  }

  return sendWhatsAppMessage(to, message);
}

export async function downloadWhatsAppMedia(mediaId: string): Promise<ArrayBuffer> {
  const accessToken = getAccessToken();

  const urlRes = await fetch(`${WHATSAPP_API_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!urlRes.ok) {
    const err = await urlRes.text();
    throw new Error(`[whatsapp-service] Media URL fetch failed (${urlRes.status}): ${err}`);
  }

  const { url } = (await urlRes.json()) as { url: string };

  const mediaRes = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!mediaRes.ok) {
    const err = await mediaRes.text();
    throw new Error(`[whatsapp-service] Media download failed (${mediaRes.status}): ${err}`);
  }

  return mediaRes.arrayBuffer();
}

function safeJsonParse(rawText: string): unknown {
  try {
    return JSON.parse(rawText);
  } catch {
    return rawText;
  }
}
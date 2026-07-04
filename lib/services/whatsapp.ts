import type { ExtractedLeadFields } from "@/lib/services/extractLeadFields";

const WHATSAPP_API_BASE = "https://graph.facebook.com/v18.0";

function getPhoneNumberId(): string {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!id) throw new Error("WHATSAPP_PHONE_NUMBER_ID is not set");
  return id;
}

function getAccessToken(): string {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error("WHATSAPP_ACCESS_TOKEN is not set");
  return token;
}

export async function sendWhatsAppMessage(to: string, message: string): Promise<void> {
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

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[whatsapp-service] Send failed (${res.status}): ${err}`);
  }

  console.log(`[whatsapp-service] Message sent to ${to}`);
}

export async function sendWhatsAppReply(to: string, fields: ExtractedLeadFields): Promise<void> {
  let message: string;

  const hasDetails = fields.budget_min_lakhs || fields.budget_max_lakhs || fields.location || fields.bhk;

  if (hasDetails) {
    const lines: string[] = [];
    const name = fields.name ? `Hi ${fields.name}! 👋` : "Hi! 👋";
    lines.push(name);
    lines.push("");
    lines.push("Thanks for reaching out to us.");
    lines.push("");
    if (fields.budget_min_lakhs || fields.budget_max_lakhs) {
      if (fields.budget_min_lakhs && fields.budget_max_lakhs) {
        lines.push(`Budget noted: ₹${fields.budget_min_lakhs}–${fields.budget_max_lakhs} Lakhs`);
      } else if (fields.budget_min_lakhs) {
        lines.push(`Budget noted: ₹${fields.budget_min_lakhs}L+`);
      } else {
        lines.push(`Budget noted: Up to ₹${fields.budget_max_lakhs}L`);
      }
    }
    if (fields.location) lines.push(`Area: ${fields.location}`);
    if (fields.bhk) lines.push(`Looking for: ${fields.bhk}`);
    lines.push("");
    lines.push("I'll share the best matching properties shortly!");
    lines.push("");
    lines.push("Our team will call you within 2 hours. 🏠");
    lines.push("");
    lines.push("— Your Property Advisor");
    message = lines.join("\n");
  } else {
    const name = fields.name ? `Hi ${fields.name}!` : "Hi!";
    message = `${name} Thanks for your message. I'll get back to you shortly with property options. Could you share your budget and preferred area? 🏠`;
  }

  await sendWhatsAppMessage(to, message);
}

export async function downloadWhatsAppMedia(mediaId: string): Promise<ArrayBuffer> {
  const accessToken = getAccessToken();

  // First get the media URL
  const urlRes = await fetch(`${WHATSAPP_API_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!urlRes.ok) {
    const err = await urlRes.text();
    throw new Error(`[whatsapp-service] Media URL fetch failed (${urlRes.status}): ${err}`);
  }

  const { url } = await urlRes.json() as { url: string };

  // Download the media
  const mediaRes = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!mediaRes.ok) {
    const err = await mediaRes.text();
    throw new Error(`[whatsapp-service] Media download failed (${mediaRes.status}): ${err}`);
  }

  return mediaRes.arrayBuffer();
}

import type { ExtractedLeadFields } from "@/lib/services/extractLeadFields";

const WHATSAPP_API_BASE = "https://graph.facebook.com/v18.0";

export interface WhatsAppSendResult {
  ok: boolean;
  status?: number;
  body?: unknown;
  error?: string;
}

type MetaErrorPayload = {
  error?: {
    message?: string;
    code?: number;
    type?: string;
  };
};

export interface WhatsAppTemplateComponent {
  type: "body";
  parameters: { type: "text"; text: string }[];
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
      const errorMessage = formatWhatsAppError(res.status, parsedBody, rawText);
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

/**
 * Sends a pre-approved WhatsApp template message. Required for any
 * business-initiated message sent outside the 24-hour customer service
 * window — e.g. the Day-0 follow-up, which fires right after a call
 * ends, before the lead has ever messaged us on WhatsApp.
 */
export async function sendWhatsAppTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[]
): Promise<WhatsAppSendResult> {
  try {
    const phoneNumberId = getPhoneNumberId();
    const accessToken = getAccessToken();

    const components: WhatsAppTemplateComponent[] =
      bodyParams.length > 0
        ? [
            {
              type: "body",
              parameters: bodyParams.map((text) => ({ type: "text", text })),
            },
          ]
        : [];

    const res = await fetch(`${WHATSAPP_API_BASE}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      }),
    });

    const rawText = await res.text();
    const parsedBody = rawText ? safeJsonParse(rawText) : null;

    if (!res.ok) {
      const errorMessage = formatWhatsAppError(res.status, parsedBody, rawText);
      console.error(errorMessage);
      return {
        ok: false,
        status: res.status,
        body: parsedBody,
        error: errorMessage,
      };
    }

    console.log(`[whatsapp-service] Template message '${templateName}' sent to ${to}`);
    return {
      ok: true,
      status: res.status,
      body: parsedBody,
    };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Unknown WhatsApp template send error";
    console.error("[whatsapp-service] Unexpected template send error:", error);
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
  const name = fields.name ? `Hi ${fields.name}!` : "Hi!";
  const details: string[] = [];

  if (fields.bhk) {
    details.push(fields.bhk);
  }

  if (fields.location) {
    details.push(`in ${fields.location}`);
  }

  let message = `${name} Thank you for sharing your requirement. I will update you shortly with matching property options.`;

  if (details.length > 0) {
    message += ` Noted: ${details.join(" ")}.`;
  }

  if (fields.budget_min_lakhs && fields.budget_max_lakhs) {
    message += ` Budget noted: Rs ${fields.budget_min_lakhs}-${fields.budget_max_lakhs} lakhs.`;
  } else if (fields.budget_min_lakhs) {
    message += ` Budget noted: Rs ${fields.budget_min_lakhs} lakhs+.`;
  } else if (fields.budget_max_lakhs) {
    message += ` Budget noted: up to Rs ${fields.budget_max_lakhs} lakhs.`;
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

function formatWhatsAppError(status: number, parsedBody: unknown, rawText: string) {
  const metaError = parsedBody as MetaErrorPayload | null;
  const message = metaError?.error?.message;
  const code = metaError?.error?.code;
  const type = metaError?.error?.type;

  if (status === 401 || code === 190) {
    return "[whatsapp-service] Send failed (401): Meta WhatsApp access token is invalid, expired, or does not have permission for this phone number. Update WHATSAPP_ACCESS_TOKEN in .env.local and restart the worker.";
  }

  if (message) {
    return `[whatsapp-service] Send failed (${status}): ${message}${code ? ` [code ${code}]` : ""}${type ? ` [${type}]` : ""}`;
  }

  return `[whatsapp-service] Send failed (${status}): ${rawText}`;
}
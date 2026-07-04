import type { ExtractedLeadFields } from "@/lib/services/extractLeadFields";

export type { ExtractedLeadFields };

const SYSTEM_PROMPT = `You are a real estate lead extraction assistant.
Extract structured data from WhatsApp messages sent by Indian property buyers to brokers.
Messages may be in Hindi, English, or Hinglish.
Respond ONLY with valid JSON, no explanation, no markdown.`;

export async function extractFromText(
  messageBody: string,
  senderName: string
): Promise<ExtractedLeadFields> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  console.log(`[extract] Sending WhatsApp message (${messageBody.length} chars) to Groq LLama...`);

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Extract from this WhatsApp message. Set null if not mentioned.
Fields: name, budget_min_lakhs, budget_max_lakhs, location, bhk,
intent (serious_buyer|just_browsing|investor),
timeline (immediate|3_months|6_months|12_months|unknown),
summary (1 sentence)

Sender name from WhatsApp: ${senderName}
Message: ${messageBody}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`[extract] Groq LLama error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const raw = data.choices[0]?.message?.content;
  if (!raw) throw new Error("[extract] Groq returned empty content");

  const parsed = JSON.parse(raw) as ExtractedLeadFields;
  console.log(`[extract] Extracted:`, { name: parsed.name, intent: parsed.intent, location: parsed.location });

  return parsed;
}

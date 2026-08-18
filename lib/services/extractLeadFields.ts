export interface ExtractedLeadFields {
  name: string | null;
  phone: string | null;
  budget_min_lakhs: number | null;
  budget_max_lakhs: number | null;
  location: string | null;
  bhk: string | null;
  property_type: string | null;
  intent: "serious_buyer" | "just_browsing" | "investor" | null;
  timeline: "immediate" | "3_months" | "6_months" | "12_months" | "unknown" | null;
  amenities: string[] | null;
  floor_preference: string | null;
  possession: string | null;
  loan_required: boolean | null;
  contact_time: string | null;
  summary: string | null;
  next_action: string | null;
  language: string | null;
}

const SYSTEM_PROMPT = `You are a real estate lead extraction assistant. Extract structured data from call transcripts between Indian real estate brokers and buyers. Respond ONLY with valid JSON, no explanation, no markdown.`;

export async function extractLeadFields(transcript: string): Promise<ExtractedLeadFields> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  console.log(`[extract] Sending transcript (${transcript.length} chars) to Groq LLama...`);

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Extract the following fields from this transcript. If a field is not mentioned, set it to null.

Fields: name, budget_min_lakhs, budget_max_lakhs, location, bhk, intent (one of: serious_buyer, just_browsing, investor), timeline (one of: immediate, 3_months, 6_months, 12_months, unknown), summary (1-2 sentences max)

Transcript: ${transcript}`,
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
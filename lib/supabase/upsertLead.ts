/**
 * /lib/supabase/upsertLead.ts
 *
 * Upserts a lead row (keyed on phone) and inserts a timeline_events row.
 * Uses the service-role key so it bypasses RLS for server-side workers.
 */

import { createClient } from "@supabase/supabase-js";
import type { ExtractedLeadFields } from "@/lib/services/extractLeadFields";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env vars not set (URL or SERVICE_ROLE_KEY)");
  }
  return createClient(url, key);
}

export interface UpsertLeadInput {
  phone: string;
  fields: ExtractedLeadFields;
  direction: "inbound" | "outbound";
  durationSec: number;
  transcript: string;
  intentTag: string | null;
  channel?: "call" | "whatsapp";
}

/**
 * budget_min / budget_max are INTEGER columns in Supabase (lakhs, whole numbers).
 * The LLM extraction can return fractional or nonsensical values (e.g. 0.05,
 * mistaking a monthly rent figure for a lakhs budget). Postgres rejects any
 * non-integer with "invalid input syntax for type integer", which fails the
 * ENTIRE upsert — losing the whole lead, not just the budget.
 *
 * This sanitizer rounds to the nearest whole lakh, and treats anything below
 * 1 lakh as not a real property budget (almost certainly a bad extraction,
 * e.g. a monthly rent number) — storing null instead of crashing the insert.
 */
function sanitizeBudgetLakhs(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;

  const rounded = Math.round(value);

  // Anything under 1 lakh isn't a realistic property budget on its own —
  // almost always a unit-confusion extraction (e.g. monthly rent in rupees
  // mistaken for a lakhs figure). Store null rather than a misleading value.
  if (rounded < 1) return null;

  return rounded;
}

function buildBaseLeadRow(phone: string, fields: ExtractedLeadFields) {
  const budgetMin = sanitizeBudgetLakhs(fields.budget_min_lakhs);
  const budgetMax = sanitizeBudgetLakhs(fields.budget_max_lakhs);

  return {
    phone,
    ...(fields.name !== null && { name: fields.name }),
    ...(budgetMin !== null && { budget_min: budgetMin }),
    ...(budgetMax !== null && { budget_max: budgetMax }),
    ...(fields.location !== null && { location: fields.location }),
    ...(fields.bhk !== null && { bhk: fields.bhk }),
    ...(fields.intent !== null && { intent: fields.intent }),
    ...(fields.timeline !== null && { timeline: fields.timeline }),
    ...(fields.summary !== null && { summary: fields.summary }),
    last_contact_at: new Date().toISOString(),
  };
}

function buildWhatsAppLeadFields(phone: string) {
  return {
    whatsapp_phone: phone,
    whatsapp_opted_in: true,
    last_whatsapp_at: new Date().toISOString(),
    preferred_channel: "whatsapp",
  };
}

function isMissingColumnError(message: string | undefined, column: string): boolean {
  return Boolean(message && message.includes(`Could not find the '${column}' column`));
}

export async function upsertLeadAndEvent(input: UpsertLeadInput): Promise<void> {
  const supabase = getSupabase();
  const { phone, fields, direction, durationSec, transcript, intentTag, channel = "call" } = input;

  const baseLeadRow = buildBaseLeadRow(phone, fields);
  const leadRow = channel === "whatsapp"
    ? { ...baseLeadRow, ...buildWhatsAppLeadFields(phone) }
    : baseLeadRow;

  let upsertError = (
    await supabase.from("leads").upsert(leadRow, {
      onConflict: "phone",
      ignoreDuplicates: false,
    })
  ).error;

  if (
    upsertError &&
    channel === "whatsapp" &&
    (
      isMissingColumnError(upsertError.message, "last_whatsapp_at") ||
      isMissingColumnError(upsertError.message, "whatsapp_phone") ||
      isMissingColumnError(upsertError.message, "whatsapp_opted_in") ||
      isMissingColumnError(upsertError.message, "preferred_channel")
    )
  ) {
    console.warn("[supabase] WhatsApp-specific lead columns are missing; retrying upsert with base lead fields only");

    upsertError = (
      await supabase.from("leads").upsert(baseLeadRow, {
        onConflict: "phone",
        ignoreDuplicates: false,
      })
    ).error;
  }

  if (upsertError) {
    throw new Error(
      `[supabase] Lead upsert failed for ${phone}: ${upsertError.message} - ${JSON.stringify(upsertError)}`
    );
  }

  console.log(`[supabase] Lead upserted for phone: ${phone}`);

  const eventRow = {
    lead_phone: phone,
    channel,
    direction,
    duration_sec: durationSec,
    transcript,
    extracted_fields: fields as unknown as Record<string, unknown>,
    intent_tag: intentTag,
  };

  const { error: eventError } = await supabase
    .from("timeline_events")
    .insert(eventRow);

  if (eventError) {
    console.error(
      `[supabase] Timeline event insert failed for ${phone}: ${eventError.message}`,
      eventError
    );
    return;
  }

  console.log(`[supabase] Timeline event inserted for phone: ${phone}`);
}
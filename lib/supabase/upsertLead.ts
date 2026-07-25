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

function buildBaseLeadRow(phone: string, fields: ExtractedLeadFields) {
  return {
    phone,
    ...(fields.name !== null && { name: fields.name }),
    ...(fields.budget_min_lakhs !== null && { budget_min: fields.budget_min_lakhs }),
    ...(fields.budget_max_lakhs !== null && { budget_max: fields.budget_max_lakhs }),
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
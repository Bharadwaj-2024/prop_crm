/**
 * /lib/supabase/upsertLead.ts
 *
 * Upserts a lead row (keyed on phone) and inserts a timeline_events row.
 * Uses the service-role key so it bypasses RLS — safe for server-side workers only.
 */

import { createClient } from "@supabase/supabase-js";
import type { ExtractedLeadFields } from "@/lib/services/extractLeadFields";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not set (URL or SERVICE_ROLE_KEY)");
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

export async function upsertLeadAndEvent(input: UpsertLeadInput): Promise<void> {
  const supabase = getSupabase();
  const { phone, fields, direction, durationSec, transcript, intentTag, channel = "call" } = input;

  // ----------------------------------------------------------------
  // 1. Upsert lead (phone is UNIQUE — update all non-null fields)
  // ----------------------------------------------------------------
  const leadRow = {
    phone,
    ...(fields.name         !== null && { name: fields.name }),
    ...(fields.budget_min_lakhs !== null && { budget_min: fields.budget_min_lakhs }),
    ...(fields.budget_max_lakhs !== null && { budget_max: fields.budget_max_lakhs }),
    ...(fields.location     !== null && { location: fields.location }),
    ...(fields.bhk          !== null && { bhk: fields.bhk }),
    ...(fields.intent       !== null && { intent: fields.intent }),
    ...(fields.timeline     !== null && { timeline: fields.timeline }),
    ...(fields.summary      !== null && { summary: fields.summary }),
    last_contact_at: new Date().toISOString(),
    ...(channel === "whatsapp" && {
      whatsapp_phone: phone,
      whatsapp_opted_in: true,
      last_whatsapp_at: new Date().toISOString(),
      preferred_channel: "whatsapp",
    }),
  };

  const { error: upsertError } = await supabase
    .from("leads")
    .upsert(leadRow, {
      onConflict: "phone",
      ignoreDuplicates: false, // always update on conflict
    });

  if (upsertError) {
    throw new Error(
      `[supabase] Lead upsert failed for ${phone}: ${upsertError.message} — ${JSON.stringify(upsertError)}`
    );
  }

  console.log(`[supabase] Lead upserted for phone: ${phone}`);

  // ----------------------------------------------------------------
  // 2. Insert timeline event
  // ----------------------------------------------------------------
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
    // Non-fatal: lead was saved. Log and continue.
    console.error(
      `[supabase] Timeline event insert failed for ${phone}: ${eventError.message}`,
      eventError
    );
    return;
  }

  console.log(`[supabase] Timeline event inserted for phone: ${phone}`);
}

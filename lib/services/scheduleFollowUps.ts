import { createClient } from "@supabase/supabase-js";
import type { ExtractedLeadFields } from "@/lib/services/extractLeadFields";
import { sendWhatsAppMessage, sendWhatsAppTemplateMessage } from "@/lib/services/whatsapp";

type FollowUpInsertRow = {
  lead_phone: string;
  message: string;
  scheduled_at: string;
  status: "pending" | "sent" | "failed";
  follow_up_day: number;
  sent_at?: string;
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function formatBudget(fields: ExtractedLeadFields): string {
  const { budget_min_lakhs, budget_max_lakhs } = fields;

  if (budget_min_lakhs && budget_max_lakhs) {
    return `Rs ${budget_min_lakhs}-${budget_max_lakhs} lakhs`;
  }

  if (budget_min_lakhs) {
    return `Rs ${budget_min_lakhs} lakhs+`;
  }

  if (budget_max_lakhs) {
    return `up to Rs ${budget_max_lakhs} lakhs`;
  }

  return "your budget";
}

function buildFollowUpMessages(fields: ExtractedLeadFields) {
  const name = fields.name ?? "there";
  const bhk = fields.bhk ?? "a property";
  const location = fields.location ?? "your preferred location";
  const budget = formatBudget(fields);

  return [
    {
      follow_up_day: 0,
      message: `Hi ${name}! Thank you for sharing your requirement for ${bhk} in ${location}. I will update you shortly with matching properties.`,
    },
    {
      follow_up_day: 1,
      message: `Hi ${name}! Following up on your search for ${bhk} in ${location} within ${budget}. I have 3 excellent options ready. When can we schedule a site visit?`,
    },
    {
      follow_up_day: 3,
      message: `Hi ${name}! Still looking for ${bhk} in ${location}? We have new listings within ${budget}. Reply to see options!`,
    },
    {
      follow_up_day: 7,
      message: `Hi ${name}! Properties in ${location} are selling fast. Don't miss out, reply YES to see latest options in ${budget}.`,
    },
    {
      follow_up_day: 14,
      message: `Hi ${name}! Final follow up: we have an exclusive ${bhk} in ${location} within ${budget}. Interested? Reply now!`,
    },
  ];
}

export async function scheduleFollowUps(
  leadPhone: string,
  fields: ExtractedLeadFields
): Promise<void> {
  const supabase = getSupabase();
  const now = new Date();
  const followUps = buildFollowUpMessages(fields);

  console.log(`[schedule-follow-up] Scheduling follow-ups for ${leadPhone}`);

  const rows: FollowUpInsertRow[] = followUps.map((followUp) => ({
    lead_phone: leadPhone,
    message: followUp.message,
    scheduled_at: addDays(now, followUp.follow_up_day).toISOString(),
    status: "pending",
    follow_up_day: followUp.follow_up_day,
  }));

  const { data, error } = await supabase
    .from("follow_ups")
    .insert(rows)
    .select("id, follow_up_day");

  if (error) {
    throw new Error(
      `[schedule-follow-up] Failed to insert follow-ups for ${leadPhone}: ${error.message}`
    );
  }

  const dayZero = followUps.find((item) => item.follow_up_day === 0);
  const dayZeroRecord = data?.find((item) => item.follow_up_day === 0);

  if (!dayZero || !dayZeroRecord) {
    throw new Error(
      `[schedule-follow-up] Missing Day 0 follow-up row for ${leadPhone}`
    );
  }

  console.log(`[schedule-follow-up] Sending Day 0 follow-up (template) to ${leadPhone}`);

  // Day 0 fires with no prior WhatsApp conversation, so it MUST use an
  // approved template rather than free-form text. Replace 'call_followup_v1'
  // with your actual approved template name, and match the parameter
  // order/count to what you defined in Meta's template body.
  const result = await sendWhatsAppTemplateMessage(
    leadPhone,
    "call_followup_v1",
    "en",
    [
      fields.name ?? "there",
      fields.bhk ?? "a property",
      fields.location ?? "your preferred location",
    ]
  );

  if (!result.ok) {
    const { error: updateError } = await supabase
      .from("follow_ups")
      .update({ status: "failed" })
      .eq("id", dayZeroRecord.id);

    if (updateError) {
      console.error(
        `[schedule-follow-up] Failed to mark Day 0 follow-up as failed for ${leadPhone}: ${updateError.message}`
      );
    }

    throw new Error(
      `[schedule-follow-up] Failed to send Day 0 follow-up to ${leadPhone}: ${result.error ?? "Unknown WhatsApp error"}`
    );
  }

  const sentAt = new Date().toISOString();
  const { error: markSentError } = await supabase
    .from("follow_ups")
    .update({
      status: "sent",
      sent_at: sentAt,
    })
    .eq("id", dayZeroRecord.id);

  if (markSentError) {
    throw new Error(
      `[schedule-follow-up] Failed to mark Day 0 follow-up as sent for ${leadPhone}: ${markSentError.message}`
    );
  }

  console.log(`[schedule-follow-up] Day 0 follow-up sent for ${leadPhone}`);
}
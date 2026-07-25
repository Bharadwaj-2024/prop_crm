import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsAppMessage } from "@/lib/services/whatsapp";

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const SEND_DELAY_MS = 1000;

type FollowUpRow = {
  id: string;
  lead_phone: string;
  message: string;
  follow_up_day: number;
};

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processPendingFollowUps(): Promise<void> {
  const supabase = getSupabase();

  console.log("[follow-up-worker] Checking for pending follow-ups...");

  const { data, error } = await supabase
    .from("follow_ups")
    .select("id, lead_phone, message, follow_up_day")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true });

  if (error) {
    console.error(
      `[follow-up-worker] Failed to fetch pending follow-ups: ${error.message}`
    );
    return;
  }

  const pending = (data ?? []) as FollowUpRow[];

  if (pending.length === 0) {
    console.log("[follow-up-worker] No pending follow-ups found.");
    return;
  }

  console.log(`[follow-up-worker] Found ${pending.length} pending follow-up(s).`);

  for (const followUp of pending) {
    console.log(
      `[follow-up-worker] Sending Day ${followUp.follow_up_day} follow-up to ${followUp.lead_phone}`
    );

    try {
      const result = await sendWhatsAppMessage(
        followUp.lead_phone,
        followUp.message
      );

      if (!result.ok) {
        throw new Error(result.error ?? "Unknown WhatsApp send error");
      }

      const { error: updateError } = await supabase
        .from("follow_ups")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
        })
        .eq("id", followUp.id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      console.log(
        `[follow-up-worker] Sent follow-up ${followUp.id} to ${followUp.lead_phone}`
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown follow-up worker error";

      console.error(
        `[follow-up-worker] Failed follow-up ${followUp.id} for ${followUp.lead_phone}: ${message}`
      );

      const { error: updateError } = await supabase
        .from("follow_ups")
        .update({ status: "failed" })
        .eq("id", followUp.id);

      if (updateError) {
        console.error(
          `[follow-up-worker] Failed to mark follow-up ${followUp.id} as failed: ${updateError.message}`
        );
      }
    }

    await sleep(SEND_DELAY_MS);
  }
}

export function startFollowUpWorker() {
  let isRunning = false;

  const runCycle = async () => {
    if (isRunning) {
      console.log("[follow-up-worker] Previous cycle still running. Skipping this interval.");
      return;
    }

    isRunning = true;

    try {
      await processPendingFollowUps();
    } catch (error) {
      console.error("[follow-up-worker] Worker cycle error:", error);
    } finally {
      isRunning = false;
    }
  };

  void runCycle();
  const interval = setInterval(() => {
    void runCycle();
  }, POLL_INTERVAL_MS);

  console.log("[follow-up-worker] Started. Polling every 5 minutes.");

  return {
    close: async () => {
      clearInterval(interval);
    },
  };
}

if (require.main === module) {
  startFollowUpWorker();
}

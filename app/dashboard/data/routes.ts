import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();

    const [{ data: leads, error: leadsError }, { data: events, error: eventsError }] =
      await Promise.all([
        supabase.from("leads").select("*").order("last_contact_at", { ascending: false }),
        supabase.from("timeline_events").select("*").order("created_at", { ascending: false }),
      ]);

    if (leadsError) {
      console.error("[dashboard/data] leads error:", leadsError);
      return NextResponse.json({ error: leadsError.message }, { status: 500 });
    }

    if (eventsError) {
      console.error("[dashboard/data] events error:", eventsError);
      return NextResponse.json({ error: eventsError.message }, { status: 500 });
    }

    return NextResponse.json({ leads: leads ?? [], events: events ?? [] });
  } catch (err) {
    console.error("[dashboard/data] fatal:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
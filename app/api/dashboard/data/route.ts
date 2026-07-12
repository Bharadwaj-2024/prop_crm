import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || url === "https://your-project-id.supabase.co") {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set in .env.local");
  }
  if (!key || key === "your_supabase_service_role_key_here") {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set in .env.local");
  }

  return createClient(url, key);
}

export async function GET() {
  try {
    const supabase = getSupabase();

    const [{ data: leads, error: leadsErr }, { data: events, error: eventsErr }] =
      await Promise.all([
        supabase.from("leads").select("*").order("last_contact_at", { ascending: false }),
        supabase.from("timeline_events").select("*").order("created_at", { ascending: false }),
      ]);

    if (leadsErr) {
      console.error("[dashboard/data] leads error:", leadsErr);
      return NextResponse.json({ error: leadsErr.message }, { status: 500 });
    }

    if (eventsErr) {
      console.error("[dashboard/data] events error:", eventsErr);
      return NextResponse.json({ error: eventsErr.message }, { status: 500 });
    }

    return NextResponse.json({ leads: leads ?? [], events: events ?? [] }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    console.error("[dashboard/data]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

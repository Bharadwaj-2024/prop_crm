import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase env vars");
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

    if (leadsErr || eventsErr) {
      return NextResponse.json({ error: leadsErr ?? eventsErr }, { status: 500 });
    }

    return NextResponse.json({ leads: leads ?? [], events: events ?? [] }, { status: 200 });
  } catch (error) {
    console.error("[dashboard/data]", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { signAccessToken } from "@/lib/auth/jwt";

export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get("refresh_token")?.value;
    if (!refreshToken) {
      return NextResponse.json({ error: "No refresh token" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: tokenRow } = await supabase
      .from("refresh_tokens")
      .select("*, brokers(*)")
      .eq("token", refreshToken)
      .eq("revoked", false)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!tokenRow?.brokers) {
      return NextResponse.json(
        { error: "Invalid or expired refresh token" },
        { status: 401 }
      );
    }

    const broker = tokenRow.brokers as Record<string, string>;

    const accessToken = await signAccessToken({
      brokerId: broker.id,
      email: broker.email,
      name: broker.name,
      role: broker.role as "broker" | "manager" | "admin",
      agencyId: broker.agency_id ?? undefined,
    });

    return NextResponse.json({ ok: true, accessToken, expiresIn: 900 });
  } catch (err) {
    console.error("[auth/refresh]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
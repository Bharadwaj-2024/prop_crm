import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@supabase/supabase-js";
import { signAccessToken } from "@/lib/auth/jwt";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { data: broker } = await supabase
      .from("brokers")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .eq("is_active", true)
      .single();

    if (!broker) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (broker.locked_until && new Date(broker.locked_until) > new Date()) {
      const mins = Math.ceil(
        (new Date(broker.locked_until).getTime() - Date.now()) / 60000
      );
      return NextResponse.json(
        { error: `Account locked. Try again in ${mins} minutes.` },
        { status: 429 }
      );
    }

    const valid = await bcrypt.compare(password, broker.password_hash);

    if (!valid) {
      const newCount = (broker.failed_login_count ?? 0) + 1;
      const shouldLock = newCount >= 5;
      await supabase
        .from("brokers")
        .update({
          failed_login_count: newCount,
          locked_until: shouldLock
            ? new Date(Date.now() + 15 * 60000).toISOString()
            : null,
        })
        .eq("id", broker.id);

      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    await supabase
      .from("brokers")
      .update({
        failed_login_count: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
      })
      .eq("id", broker.id);

    const userAgent = req.headers.get("user-agent") ?? "unknown";
    const ipAddress = req.headers.get("x-forwarded-for") ?? "unknown";

    await supabase.from("auth_users").upsert(
      {
        broker_id: broker.id,
        email: broker.email,
        name: broker.name,
        role: broker.role,
        agency_id: broker.agency_id ?? null,
        user_agent: userAgent,
        ip_address: ipAddress,
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "broker_id" }
    );

    const accessToken = await signAccessToken({
      brokerId: broker.id,
      email: broker.email,
      name: broker.name,
      role: broker.role,
      agencyId: broker.agency_id ?? undefined,
    });

    const refreshToken = uuidv4() + "-" + uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await supabase.from("refresh_tokens").insert({
      broker_id: broker.id,
      token: refreshToken,
      device_info: req.headers.get("user-agent") ?? "unknown",
      ip_address: req.headers.get("x-forwarded-for") ?? "unknown",
      expires_at: expiresAt.toISOString(),
    });

    const response = NextResponse.json({
      ok: true,
      accessToken,
      broker: {
        id: broker.id,
        email: broker.email,
        name: broker.name,
        role: broker.role,
      },
      expiresIn: 900,
    });

    response.cookies.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
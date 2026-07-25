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
    const normalizedEmail = typeof email === "string" ? email.toLowerCase().trim() : "";

    console.log("[auth/login] request received", {
      email: normalizedEmail,
      hasPassword: Boolean(password),
    });

    if (!normalizedEmail || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Fetch broker
    const { data: broker, error: brokerError } = await supabase
      .from("brokers")
      .select("*")
      .eq("email", normalizedEmail)
      .eq("is_active", true)
      .single();

    if (brokerError) {
      console.log("[auth/login] broker query error", brokerError.message);
    }

    console.log("[auth/login] broker lookup result", {
      found: Boolean(broker),
      brokerId: broker?.id,
      brokerEmail: broker?.email,
    });

    if (!broker) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Check lockout
    if (broker.locked_until && new Date(broker.locked_until) > new Date()) {
      const mins = Math.ceil(
        (new Date(broker.locked_until).getTime() - Date.now()) / 60000
      );
      return NextResponse.json(
        { error: `Account locked. Try again in ${mins} minutes.` },
        { status: 429 }
      );
    }

    // Verify password
    console.log("[auth/login] comparing password hash");
    const valid = await bcrypt.compare(password, broker.password_hash);
    console.log("[auth/login] password comparison result", { valid });

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

    // Reset failed attempts
    await supabase
      .from("brokers")
      .update({
        failed_login_count: 0,
        locked_until: null,
        last_login_at: new Date().toISOString(),
      })
      .eq("id", broker.id);

    // Sign access token
    console.log("[auth/login] signing access token");
    const accessToken = await signAccessToken({
      brokerId: broker.id,
      email: broker.email,
      name: broker.name,
      role: broker.role,
      agencyId: broker.agency_id ?? undefined,
    });

    // Create refresh token
    const refreshToken = uuidv4() + "-" + uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await supabase.from("refresh_tokens").insert({
      broker_id: broker.id,
      token: refreshToken,
      device_info: req.headers.get("user-agent") ?? "unknown",
      ip_address: req.headers.get("x-forwarded-for") ?? "unknown",
      expires_at: expiresAt.toISOString(),
    });

    console.log("[auth/login] login successful", { brokerId: broker.id });

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
    console.error("[auth/login] fatal error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
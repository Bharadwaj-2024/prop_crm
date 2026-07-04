"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const COLORS = {
  gold: "#C9A84C",
  richGold: "#F0C040",
  darkGold: "#A07830",
  black: "#0A0A0A",
  deepBlack: "#111111",
  charcoal: "#1A1A1A",
  offWhite: "#F5F0E8",
  warmWhite: "#E8E0D0",
  muted: "#6B6B6B",
} as const;

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [buttonHover, setButtonHover] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }

      sessionStorage.setItem("access_token", data.accessToken);
      sessionStorage.setItem("broker", JSON.stringify(data.broker));
      document.cookie = `session_token=${data.accessToken}; path=/; max-age=900; SameSite=Lax`;

      router.push("/dashboard");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = (focused: boolean) => ({
    width: "100%",
    padding: "12px 16px",
    borderRadius: "10px",
    border: focused ? `1px solid ${COLORS.gold}` : "1px solid rgba(201,168,76,0.2)",
    background: COLORS.charcoal,
    color: COLORS.offWhite,
    outline: "none",
    fontSize: "14px",
    lineHeight: 1.6,
    boxShadow: focused ? "0 0 0 3px rgba(201,168,76,0.1)" : "none",
    transition: "all 0.2s ease",
    boxSizing: "border-box" as const,
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        fontFamily: "Inter, -apple-system, sans-serif",
        background:
          "radial-gradient(ellipse at center, rgba(201,168,76,0.08) 0%, #0A0A0A 70%)",
        color: COLORS.offWhite,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: COLORS.deepBlack,
          border: "1px solid rgba(201,168,76,0.3)",
          borderRadius: "20px",
          padding: "48px",
          boxShadow:
            "0 24px 80px rgba(201,168,76,0.15), 0 0 0 1px rgba(201,168,76,0.1)",
          backdropFilter: "blur(18px)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div
            style={{
              width: "64px",
              height: "64px",
              margin: "0 auto 24px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #C9A84C, #F0C040)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              boxShadow: "0 8px 24px rgba(201,168,76,0.28)",
            }}
          >
            📞
          </div>
          <h1
            style={{
              margin: 0,
              color: COLORS.gold,
              fontSize: "28px",
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            CallCRM
          </h1>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "13px",
              lineHeight: 1.6,
              color: COLORS.muted,
            }}
          >
            Real Estate Intelligence Platform
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: "18px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                color: COLORS.gold,
                fontSize: "12px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setEmailFocused(true)}
              onBlur={() => setEmailFocused(false)}
              placeholder="you@agency.com"
              style={inputStyle(emailFocused)}
            />
          </div>

          <div style={{ marginBottom: "24px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                color: COLORS.gold,
                fontSize: "12px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={password}
              required
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              placeholder="••••••••"
              style={inputStyle(passwordFocused)}
            />
          </div>

          {error && (
            <div
              style={{
                marginBottom: "16px",
                padding: "12px 14px",
                borderRadius: "8px",
                background: "rgba(220,38,38,0.1)",
                border: "1px solid rgba(220,38,38,0.3)",
                color: "#FCA5A5",
                fontSize: "13px",
                lineHeight: 1.6,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            onMouseEnter={() => setButtonHover(true)}
            onMouseLeave={() => setButtonHover(false)}
            style={{
              width: "100%",
              border: "none",
              borderRadius: "10px",
              padding: "14px",
              fontSize: "15px",
              fontWeight: 800,
              color: COLORS.black,
              cursor: loading ? "not-allowed" : "pointer",
              background:
                "linear-gradient(135deg, #C9A84C 0%, #F0C040 50%, #C9A84C 100%)",
              boxShadow: buttonHover
                ? "0 8px 32px rgba(201,168,76,0.6), 0 0 0 1px rgba(201,168,76,0.2)"
                : "0 4px 20px rgba(201,168,76,0.4)",
              opacity: loading ? 0.7 : 1,
              transform: buttonHover && !loading ? "translateY(-1px)" : "translateY(0)",
              transition: "all 0.2s ease",
            }}
          >
            {loading ? "Authenticating..." : "Sign in"}
          </button>
        </form>

        <p
          style={{
            margin: "20px 0 0",
            textAlign: "center",
            fontSize: "11px",
            color: "#3A3A3A",
            letterSpacing: "0.04em",
          }}
        >
          Secured with JWT Authentication
        </p>
      </div>
    </div>
  );
}
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        credentials: "include",
      });

      console.log("login response:", res.status, await res.clone().text());
      const data = await res.json();
      console.log("[login] parsed response:", data);

      if (!data.ok) {
        setError(data.error ?? "Login failed");
        return;
      }

      // Store in sessionStorage
      sessionStorage.setItem("access_token", data.accessToken);
      sessionStorage.setItem("broker", JSON.stringify(data.broker));

      // Set session cookie for middleware page protection
      document.cookie = `session_token=${data.accessToken}; path=/; max-age=900`;

      // Small delay to ensure cookie is set
      await new Promise((r) => setTimeout(r, 100));

      router.push("/dashboard");
      router.refresh();

    } catch (err) {
      console.error("[login] error:", err);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "radial-gradient(ellipse at center, rgba(201,168,76,0.08) 0%, #0A0A0A 70%)",
      fontFamily: "Inter, -apple-system, sans-serif",
    }}>
      <div style={{
        background: "#111111",
        borderRadius: "20px",
        padding: "48px",
        width: "100%",
        maxWidth: "420px",
        border: "1px solid rgba(201,168,76,0.3)",
        boxShadow: "0 24px 80px rgba(201,168,76,0.15), 0 0 0 1px rgba(201,168,76,0.1)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            width: "64px", height: "64px", borderRadius: "16px",
            background: "linear-gradient(135deg, #C9A84C, #F0C040)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px", fontSize: "28px",
            boxShadow: "0 8px 24px rgba(201,168,76,0.3)",
          }}>📞</div>
          <h1 style={{ margin: "0 0 4px", fontSize: "28px", fontWeight: 800, color: "#C9A84C", letterSpacing: "-0.02em" }}>
            CallCRM
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#6B6B6B" }}>
            Real Estate Intelligence Platform
          </p>
        </div>

        <form onSubmit={handleLogin}>
          {/* Email */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{
              display: "block", fontSize: "11px", fontWeight: 600,
              color: "#C9A84C", marginBottom: "8px",
              textTransform: "uppercase", letterSpacing: "0.08em"
            }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@agency.com"
              style={{
                width: "100%", padding: "12px 16px",
                background: "#1A1A1A",
                border: "1px solid rgba(201,168,76,0.2)",
                borderRadius: "10px", fontSize: "14px",
                color: "#F5F0E8", outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={(e) => e.target.style.borderColor = "#C9A84C"}
              onBlur={(e) => e.target.style.borderColor = "rgba(201,168,76,0.2)"}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: "24px" }}>
            <label style={{
              display: "block", fontSize: "11px", fontWeight: 600,
              color: "#C9A84C", marginBottom: "8px",
              textTransform: "uppercase", letterSpacing: "0.08em"
            }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              style={{
                width: "100%", padding: "12px 16px",
                background: "#1A1A1A",
                border: "1px solid rgba(201,168,76,0.2)",
                borderRadius: "10px", fontSize: "14px",
                color: "#F5F0E8", outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={(e) => e.target.style.borderColor = "#C9A84C"}
              onBlur={(e) => e.target.style.borderColor = "rgba(201,168,76,0.2)"}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: "10px 14px",
              background: "rgba(220,38,38,0.1)",
              border: "1px solid rgba(220,38,38,0.3)",
              borderRadius: "8px", marginBottom: "16px",
              fontSize: "13px", color: "#FCA5A5",
              display: "flex", alignItems: "center", gap: "8px"
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "14px",
              background: loading
                ? "rgba(201,168,76,0.5)"
                : "linear-gradient(135deg, #C9A84C 0%, #F0C040 50%, #C9A84C 100%)",
              color: "#0A0A0A", border: "none",
              borderRadius: "10px", fontSize: "15px",
              fontWeight: 800, cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 4px 20px rgba(201,168,76,0.4)",
              transition: "all 0.2s ease",
            }}
          >
            {loading ? "Authenticating..." : "Sign in →"}
          </button>
        </form>

        <p style={{ textAlign: "center", color: "#3A3A3A", fontSize: "11px", marginTop: "24px" }}>
          🔒 Secured with JWT Authentication
        </p>
      </div>
    </div>
  );
}
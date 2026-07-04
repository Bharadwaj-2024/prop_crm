"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Lead = {
  id: string;
  phone: string;
  name: string | null;
  budget_min: number | null;
  budget_max: number | null;
  location: string | null;
  bhk: string | null;
  intent: string | null;
  timeline: string | null;
  summary: string | null;
  stage: string;
  last_contact_at: string | null;
  last_whatsapp_at: string | null;
  preferred_channel: string | null;
  created_at: string;
};

type TimelineEvent = {
  id: string;
  lead_phone: string;
  channel: string;
  direction: string;
  duration_sec: number | null;
  transcript: string | null;
  extracted_fields: Record<string, unknown> | null;
  intent_tag: string | null;
  created_at: string;
};

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

function formatBudget(min: number | null, max: number | null): string {
  if (!min && !max) return "—";
  if (min && max) return `₹${min}–${max}L`;
  if (min) return `₹${min}L+`;
  return `Up to ₹${max}L`;
}

function formatDuration(sec: number | null): string {
  if (!sec) return "0:00";
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

function safeText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<"all" | "call" | "whatsapp">("all");
  const [intentFilter, setIntentFilter] = useState<"all" | "serious_buyer" | "investor" | "just_browsing">("all");
  const [stageFilter, setStageFilter] = useState<"all" | "new" | "contacted" | "site_visit" | "negotiation" | "closed">("all");
  const [query, setQuery] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [now, setNow] = useState("");
  const [loading, setLoading] = useState(true);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/dashboard/data", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        setError(JSON.stringify(data.error ?? data, null, 2));
        setLoading(false);
        return;
      }

      setLeads((data.leads ?? []) as Lead[]);
      setEvents((data.events ?? []) as TimelineEvent[]);
      setError(null);
    } catch (fetchError) {
      setError(JSON.stringify(fetchError, null, 2));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    setNow(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    const clockTimer = setInterval(() => {
      setNow(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    }, 60000);
    const refreshTimer = setInterval(() => {
      fetchData();
    }, 30000);

    return () => {
      clearInterval(clockTimer);
      clearInterval(refreshTimer);
    };
  }, [fetchData]);

  const todayStr = new Date().toDateString();
  const callsToday = events.filter((e) => e.channel === "call" && new Date(e.created_at).toDateString() === todayStr).length;
  const serious = leads.filter((l) => l.intent === "serious_buyer").length;
  const investors = leads.filter((l) => l.intent === "investor").length;

  const filteredLeads = useMemo(() => {
    const leadPhonesForChannel =
      channelFilter === "all"
        ? null
        : new Set(events.filter((event) => event.channel === channelFilter).map((event) => event.lead_phone));

    return leads.filter((lead) => {
      const matchesSearch =
        !query ||
        [lead.name, lead.phone, lead.location, lead.bhk, lead.summary]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(query.toLowerCase()));

      const matchesChannel =
        !leadPhonesForChannel || leadPhonesForChannel.has(lead.phone);

      const matchesIntent = intentFilter === "all" || lead.intent === intentFilter;
      const matchesStage = stageFilter === "all" || lead.stage === stageFilter;

      return matchesSearch && matchesChannel && matchesIntent && matchesStage;
    });
  }, [channelFilter, events, intentFilter, leads, query, stageFilter]);

  const selectedEvents = useMemo(
    () =>
      events
        .filter((event) => event.lead_phone === selectedLead?.phone)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [events, selectedLead]
  );

  const statCards = [
    {
      label: "Total Leads",
      value: leads.length,
      sub: `${events.length} total events`,
      icon: "👥",
      tint: "rgba(201,168,76,0.15)",
      iconColor: COLORS.gold,
    },
    {
      label: "Serious Buyers",
      value: serious,
      sub: leads.length ? `${Math.round((serious / leads.length) * 100)}% of leads` : "—",
      icon: "🔥",
      tint: "rgba(16,185,129,0.1)",
      iconColor: "#10B981",
    },
    {
      label: "Investors",
      value: investors,
      sub: leads.length ? `${Math.round((investors / leads.length) * 100)}% of leads` : "—",
      icon: "💼",
      tint: "rgba(245,158,11,0.1)",
      iconColor: "#F59E0B",
    },
    {
      label: "Calls Today",
      value: callsToday,
      sub: `${events.length} all-time`,
      icon: "📞",
      tint: "rgba(239,68,68,0.1)",
      iconColor: "#EF4444",
    },
  ];

  const badgeStyle = (bg: string, border: string, color: string) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "3px 10px",
    borderRadius: "999px",
    background: bg,
    border: `1px solid ${border}`,
    color,
    fontSize: "11px",
    fontWeight: 600,
    whiteSpace: "nowrap" as const,
  });

  const leadCount = filteredLeads.length;

  async function copyPhone(phone: string) {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedPhone(phone);
      window.setTimeout(() => setCopiedPhone(null), 1200);
    } catch {
      setCopiedPhone(null);
    }
  }

  async function handleSignOut() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      sessionStorage.removeItem("access_token");
      sessionStorage.removeItem("broker");
      document.cookie = "session_token=; path=/; max-age=0; SameSite=Lax";
      document.cookie = "refresh_token=; path=/; max-age=0; SameSite=Lax";
      router.push("/");
      router.refresh();
    }
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: COLORS.black, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "Inter, -apple-system, sans-serif", color: COLORS.offWhite }}>
        <div style={{ maxWidth: 560, width: "100%", background: COLORS.deepBlack, border: "1px solid rgba(201,168,76,0.2)", borderRadius: 20, padding: 24, boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}>
          <div style={{ fontSize: 28, color: COLORS.gold, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ margin: "0 0 10px", color: COLORS.gold, fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>Connection Error</h2>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: COLORS.warmWhite, fontSize: 12, lineHeight: 1.7, background: COLORS.charcoal, border: "1px solid rgba(201,168,76,0.14)", borderRadius: 12, padding: 16 }}>{error}</pre>
          <button onClick={fetchData} style={{ marginTop: 16, border: "1px solid rgba(201,168,76,0.3)", background: "rgba(201,168,76,0.1)", color: COLORS.gold, borderRadius: 10, padding: "10px 14px", fontWeight: 700, cursor: "pointer" }}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.black, color: COLORS.offWhite, fontFamily: "Inter, -apple-system, sans-serif" }}>
      <div style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 64, background: COLORS.deepBlack, borderRight: "1px solid rgba(201,168,76,0.1)", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, zIndex: 20 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #C9A84C, #A07830)", color: COLORS.black, fontSize: 18, boxShadow: "0 8px 24px rgba(201,168,76,0.2)" }}>📞</div>
        {[
          { icon: "▣", active: true },
          { icon: "◫", active: false },
          { icon: "⟡", active: false },
          { icon: "⚙", active: false },
        ].map((item, index) => (
          <div key={index} style={{ width: 40, height: 40, borderRadius: 10, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", color: item.active ? COLORS.gold : "#3A3A3A", background: item.active ? "rgba(201,168,76,0.1)" : "transparent", border: item.active ? "1px solid rgba(201,168,76,0.2)" : "1px solid transparent", fontSize: 20 }}>
            {item.icon}
          </div>
        ))}
      </div>

      <main style={{ marginLeft: 64, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", color: COLORS.offWhite }}>Call Intelligence</h1>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: COLORS.muted }}>Live since {now || "—"} minutes ago</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={fetchData} style={{ border: "1px solid rgba(201,168,76,0.3)", background: "rgba(201,168,76,0.1)", color: COLORS.gold, borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <button
              onClick={handleSignOut}
              style={{
                border: "1px solid rgba(201,168,76,0.2)",
                background: COLORS.deepBlack,
                color: COLORS.warmWhite,
                borderRadius: 8,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              Sign out
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
          {statCards.map((card) => (
            <div key={card.label} style={{ background: COLORS.deepBlack, border: "1px solid rgba(201,168,76,0.15)", borderRadius: 16, padding: 20, boxShadow: "0 4px 20px rgba(0,0,0,0.4)", transition: "all 0.2s ease" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: card.tint, color: card.iconColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16 }}>{card.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.muted, letterSpacing: "0.08em", textTransform: "uppercase" }}>{card.label}</div>
              <div style={{ marginTop: 10, fontSize: 32, fontWeight: 800, color: COLORS.offWhite, letterSpacing: "-0.02em" }}>{card.value}</div>
              <div style={{ marginTop: 6, fontSize: 12, color: COLORS.warmWhite }}>{card.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ background: COLORS.deepBlack, border: "1px solid rgba(201,168,76,0.1)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <form style={{ display: "grid", gridTemplateColumns: "1.4fr 0.8fr 0.8fr 0.8fr auto", gap: 12, alignItems: "center" }} onSubmit={(e) => e.preventDefault()}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search leads, phone, location, summary" style={{ width: "100%", background: COLORS.charcoal, border: "1px solid rgba(201,168,76,0.2)", borderRadius: 8, padding: "10px 14px", color: COLORS.offWhite, fontSize: 13, outline: "none" }} />
            <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value as "all" | "call" | "whatsapp")} style={{ width: "100%", background: COLORS.charcoal, border: "1px solid rgba(201,168,76,0.2)", borderRadius: 8, padding: "10px 14px", color: COLORS.offWhite, fontSize: 13, outline: "none" }}>
              <option value="all">All channels</option>
              <option value="call">Calls</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
            <select value={intentFilter} onChange={(e) => setIntentFilter(e.target.value as typeof intentFilter)} style={{ width: "100%", background: COLORS.charcoal, border: "1px solid rgba(201,168,76,0.2)", borderRadius: 8, padding: "10px 14px", color: COLORS.offWhite, fontSize: 13, outline: "none" }}>
              <option value="all">All intents</option>
              <option value="serious_buyer">Serious buyers</option>
              <option value="investor">Investors</option>
              <option value="just_browsing">Browsing</option>
            </select>
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value as typeof stageFilter)} style={{ width: "100%", background: COLORS.charcoal, border: "1px solid rgba(201,168,76,0.2)", borderRadius: 8, padding: "10px 14px", color: COLORS.offWhite, fontSize: 13, outline: "none" }}>
              <option value="all">All stages</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="site_visit">Site Visit</option>
              <option value="negotiation">Negotiation</option>
              <option value="closed">Closed</option>
            </select>
            <div style={{ fontSize: 12, color: COLORS.muted, whiteSpace: "nowrap" }}>{leadCount} results</div>
          </form>
        </div>

        <div style={{ background: COLORS.deepBlack, border: "1px solid rgba(201,168,76,0.1)", borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
          <div style={{ padding: "12px 20px", background: COLORS.black, borderBottom: "1px solid rgba(201,168,76,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: COLORS.offWhite, fontWeight: 700 }}>Leads</div>
            <div style={{ color: COLORS.muted, fontSize: 12 }}>{leadCount} visible</div>
          </div>

          {loading ? (
            <div style={{ padding: 24 }}>
              <div style={{ height: 16, borderRadius: 8, background: "linear-gradient(90deg, #1A1A1A 25%, #222222 50%, #1A1A1A 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.5s infinite" }} />
            </div>
          ) : leadCount === 0 ? (
            <div style={{ padding: 48, textAlign: "center" }}>
              <div style={{ fontSize: 48, color: COLORS.gold, opacity: 0.4, marginBottom: 12 }}>🏛️</div>
              <div style={{ color: COLORS.offWhite, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>No leads yet</div>
              <div style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.6 }}>{query || channelFilter !== "all" || intentFilter !== "all" || stageFilter !== "all" ? "Clear filters to see all results" : "Make a call to generate your first lead"}</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: COLORS.black, borderBottom: "1px solid rgba(201,168,76,0.1)" }}>
                    {['Lead', 'Channel', 'Budget', 'Location', 'BHK', 'Intent', 'Timeline', 'Stage', 'Last Contact', 'Actions'].map((header) => (
                      <th key={header} style={{ padding: "12px 20px", textAlign: "left", fontSize: 10, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap" }}>{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead, index) => {
                    const hasCall = events.some((event) => event.lead_phone === lead.phone && event.channel === "call");
                    const hasWA = events.some((event) => event.lead_phone === lead.phone && event.channel === "whatsapp");
                    const intentColor =
                      lead.intent === "serious_buyer"
                        ? { bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.2)", color: "#10B981" }
                        : lead.intent === "investor"
                          ? { bg: "rgba(201,168,76,0.1)", border: "rgba(201,168,76,0.3)", color: COLORS.gold }
                          : { bg: "rgba(107,107,107,0.1)", border: "rgba(107,107,107,0.2)", color: "#9CA3AF" };

                    const stageColor =
                      lead.stage === "new"
                        ? { bg: "rgba(201,168,76,0.1)", border: "rgba(201,168,76,0.25)", color: COLORS.gold }
                        : lead.stage === "contacted"
                          ? { bg: "rgba(59,130,246,0.1)", border: "rgba(59,130,246,0.2)", color: "#60A5FA" }
                          : lead.stage === "site_visit"
                            ? { bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)", color: "#F59E0B" }
                            : lead.stage === "negotiation"
                              ? { bg: "rgba(168,85,247,0.1)", border: "rgba(168,85,247,0.2)", color: "#C084FC" }
                              : { bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.2)", color: "#10B981" };

                    return (
                      <tr
                        key={lead.id}
                        style={{ background: index % 2 === 0 ? COLORS.deepBlack : "#131313", borderBottom: "1px solid rgba(255,255,255,0.03)", transition: "all 0.15s ease" }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(201,168,76,0.05)";
                          e.currentTarget.style.borderLeft = `2px solid ${COLORS.gold}`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = index % 2 === 0 ? COLORS.deepBlack : "#131313";
                          e.currentTarget.style.borderLeft = "none";
                        }}
                      >
                        <td style={{ padding: "16px 20px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #C9A84C, #A07830)", color: COLORS.black, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, boxShadow: "0 4px 12px rgba(201,168,76,0.14)" }}>
                              {(lead.name ?? lead.phone)[0].toUpperCase()}
                            </div>
                            <div>
                              <div style={{ color: COLORS.offWhite, fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>{lead.name ?? "Unknown"}</div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                                <div style={{ color: COLORS.muted, fontSize: 11 }}>{lead.phone}</div>
                                <button
                                  type="button"
                                  onClick={() => copyPhone(lead.phone)}
                                  style={{ background: "transparent", border: "none", color: copiedPhone === lead.phone ? COLORS.richGold : COLORS.muted, fontSize: 12, cursor: "pointer", padding: 0 }}
                                >
                                  {copiedPhone === lead.phone ? "Copied" : "Copy phone"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "16px 20px", color: COLORS.warmWhite, fontSize: 13 }}>{hasCall ? "📞" : ""}{hasWA ? " 💬" : ""}</td>
                        <td style={{ padding: "16px 20px", color: COLORS.warmWhite, fontSize: 13 }}>{formatBudget(lead.budget_min, lead.budget_max)}</td>
                        <td style={{ padding: "16px 20px", color: COLORS.warmWhite, fontSize: 13 }}>{lead.location ?? "—"}</td>
                        <td style={{ padding: "16px 20px", color: COLORS.warmWhite, fontSize: 13 }}>{lead.bhk ?? "—"}</td>
                        <td style={{ padding: "16px 20px" }}>
                          <span style={badgeStyle(intentColor.bg, intentColor.border, intentColor.color)}>{lead.intent ?? "just_browsing"}</span>
                        </td>
                        <td style={{ padding: "16px 20px" }}>
                          <span style={badgeStyle("rgba(107,107,107,0.1)", "rgba(107,107,107,0.2)", COLORS.warmWhite)}>{lead.timeline ?? "unknown"}</span>
                        </td>
                        <td style={{ padding: "16px 20px" }}>
                          <span style={badgeStyle(stageColor.bg, stageColor.border, stageColor.color)}>{lead.stage}</span>
                        </td>
                        <td style={{ padding: "16px 20px", color: COLORS.warmWhite, fontSize: 13 }}>{relativeTime(lead.last_contact_at)}</td>
                        <td style={{ padding: "16px 20px" }}>
                          <button
                            type="button"
                            onClick={() => setSelectedLead(lead)}
                            style={{ background: "rgba(201,168,76,0.1)", color: COLORS.gold, border: "1px solid rgba(201,168,76,0.3)", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.2s ease" }}
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ background: COLORS.deepBlack, border: "1px solid rgba(201,168,76,0.1)", borderRadius: 16, overflow: "hidden" }}>
          <div style={{ padding: "12px 20px", background: COLORS.black, borderBottom: "1px solid rgba(201,168,76,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: COLORS.offWhite, fontWeight: 700 }}>Recent Events</div>
            <div style={{ color: COLORS.muted, fontSize: 12 }}>{events.length} total</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
            {events.slice(0, 8).map((event) => {
              const isInbound = event.direction === "inbound";
              const extracted = event.extracted_fields ?? {};
              const summary = safeText(extracted.summary) ?? event.transcript ?? null;
              return (
                <div key={event.id} style={{ background: "#0F0F0F", border: "1px solid rgba(201,168,76,0.1)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ background: COLORS.black, borderBottom: "1px solid rgba(201,168,76,0.08)", padding: "12px 14px", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div>
                      <div style={{ color: COLORS.offWhite, fontSize: 13, fontWeight: 600 }}>{event.lead_phone}</div>
                      <div style={{ marginTop: 4, display: "inline-flex", alignItems: "center", gap: 6, ...badgeStyle(isInbound ? "rgba(16,185,129,0.1)" : "rgba(59,130,246,0.1)", isInbound ? "rgba(16,185,129,0.2)" : "rgba(59,130,246,0.2)", isInbound ? "#10B981" : "#60A5FA") }}>
                        {isInbound ? "Inbound" : "Outbound"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: COLORS.gold, fontSize: 12, fontWeight: 600 }}>{formatDuration(event.duration_sec)}</div>
                      <div style={{ color: COLORS.muted, fontSize: 11 }}>{relativeTime(event.created_at)}</div>
                    </div>
                  </div>

                  <div style={{ padding: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: summary ? 10 : 0 }}>
                      {[
                        ["Name", safeText(extracted.name)],
                        ["Budget", safeText(extracted.budget_min_lakhs) ? `₹${safeText(extracted.budget_min_lakhs)}–${safeText(extracted.budget_max_lakhs) ?? ""}L` : null],
                        ["Location", safeText(extracted.location)],
                        ["BHK", safeText(extracted.bhk)],
                        ["Intent", safeText(extracted.intent)],
                        ["Timeline", safeText(extracted.timeline)],
                      ].map(([label, value]) => (
                        <div key={label} style={{ background: COLORS.charcoal, borderRadius: 8, padding: 10, border: "1px solid rgba(201,168,76,0.08)" }}>
                          <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                          <div style={{ color: COLORS.offWhite, fontSize: 12, fontWeight: 600 }}>{value ?? "—"}</div>
                        </div>
                      ))}
                    </div>

                    {summary && (
                      <div style={{ background: "rgba(201,168,76,0.04)", border: "1px solid rgba(201,168,76,0.15)", borderLeft: `3px solid ${COLORS.darkGold}`, borderRadius: 10, padding: 12, color: COLORS.gold, fontSize: 12, lineHeight: 1.8 }}>
                        {summary}
                      </div>
                    )}

                    {event.transcript && (
                      <details style={{ marginTop: 10 }}>
                        <summary style={{ cursor: "pointer", color: COLORS.gold, fontSize: 13, fontWeight: 600, listStyle: "none" }}>Transcript</summary>
                        <div style={{ marginTop: 10, background: "#050505", border: "1px solid rgba(201,168,76,0.1)", color: COLORS.gold, borderRadius: 8, padding: 16, fontFamily: "monospace", fontSize: 12, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{event.transcript}</div>
                      </details>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {selectedLead && (
        <div onClick={() => setSelectedLead(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 900, maxHeight: "90vh", overflow: "hidden", borderRadius: 20, background: COLORS.deepBlack, border: "1px solid rgba(201,168,76,0.2)", boxShadow: "0 32px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(201,168,76,0.1)" }}>
            <div style={{ padding: 20, background: "linear-gradient(135deg, #111111, #1A1A0A)", borderBottom: "1px solid rgba(201,168,76,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg, #C9A84C, #A07830)", color: COLORS.black, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18, boxShadow: "0 8px 24px rgba(201,168,76,0.15)" }}>
                  {(selectedLead.name ?? selectedLead.phone)[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ color: COLORS.offWhite, fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{selectedLead.name ?? "Unknown"}</div>
                  <div style={{ color: COLORS.muted, fontSize: 13, marginTop: 4 }}>{selectedLead.phone}</div>
                </div>
              </div>
              <button onClick={() => setSelectedLead(null)} style={{ background: "rgba(201,168,76,0.1)", color: COLORS.gold, border: "1px solid rgba(201,168,76,0.2)", borderRadius: 8, width: 34, height: 34, cursor: "pointer", fontSize: 18 }}>×</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", maxHeight: "calc(90vh - 90px)" }}>
              <div style={{ background: "#0F0F0F", borderRight: "1px solid rgba(201,168,76,0.1)", padding: 20, overflowY: "auto" }}>
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 10, color: COLORS.gold, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Lead Summary</div>
                  <div style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.2)", borderLeft: `3px solid ${COLORS.gold}`, borderRadius: 10, padding: 14, color: COLORS.offWhite, fontSize: 13, lineHeight: 1.7 }}>{selectedLead.summary ?? "No AI summary available yet."}</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
                  {[
                    ["Budget", formatBudget(selectedLead.budget_min, selectedLead.budget_max)],
                    ["Location", selectedLead.location ?? "—"],
                    ["BHK", selectedLead.bhk ?? "—"],
                    ["Intent", selectedLead.intent ?? "—"],
                    ["Timeline", selectedLead.timeline ?? "—"],
                    ["Stage", selectedLead.stage],
                  ].map(([label, value]) => (
                    <div key={label} style={{ background: COLORS.charcoal, borderRadius: 10, border: "1px solid rgba(201,168,76,0.08)", padding: 10 }}>
                      <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                      <div style={{ color: COLORS.offWhite, fontSize: 14, fontWeight: 600 }}>{value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => copyPhone(selectedLead.phone)} style={{ flex: 1, background: "rgba(201,168,76,0.1)", color: COLORS.gold, border: "1px solid rgba(201,168,76,0.3)", borderRadius: 8, padding: "10px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{copiedPhone === selectedLead.phone ? "Copied" : "Copy phone"}</button>
                  <a href={`tel:${selectedLead.phone}`} style={{ flex: 1, textAlign: "center", textDecoration: "none", background: "rgba(201,168,76,0.1)", color: COLORS.gold, border: "1px solid rgba(201,168,76,0.3)", borderRadius: 8, padding: "10px 14px", fontSize: 12, fontWeight: 600 }}>Call</a>
                </div>
              </div>

              <div style={{ background: COLORS.deepBlack, padding: 20, overflowY: "auto" }}>
                <div style={{ fontSize: 10, color: COLORS.gold, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Timeline ({selectedEvents.length})</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {selectedEvents.length === 0 ? (
                    <div style={{ color: COLORS.muted, fontSize: 13, padding: 20 }}>No events yet.</div>
                  ) : (
                    selectedEvents.map((event) => {
                      const inbound = event.direction === "inbound";
                      const extracted = event.extracted_fields ?? {};
                      const summary = safeText(extracted.summary) ?? event.transcript ?? null;
                      return (
                        <div key={event.id} style={{ background: "#0F0F0F", border: "1px solid rgba(201,168,76,0.1)", borderRadius: 12, overflow: "hidden" }}>
                          <div style={{ background: COLORS.black, borderBottom: "1px solid rgba(201,168,76,0.08)", padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: inbound ? "rgba(16,185,129,0.1)" : "rgba(59,130,246,0.1)", color: inbound ? "#10B981" : "#60A5FA" }}>{inbound ? "📲" : "📤"}</div>
                              <div>
                                <div style={{ color: COLORS.offWhite, fontSize: 13, fontWeight: 700 }}>{event.channel} · {event.direction}</div>
                                <div style={{ marginTop: 4, display: "inline-flex", alignItems: "center", gap: 6, ...badgeStyle(inbound ? "rgba(16,185,129,0.1)" : "rgba(59,130,246,0.1)", inbound ? "rgba(16,185,129,0.2)" : "rgba(59,130,246,0.2)", inbound ? "#10B981" : "#60A5FA") }}>
                                  {event.lead_phone}
                                </div>
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ color: COLORS.gold, fontSize: 13, fontWeight: 700 }}>{formatDuration(event.duration_sec)}</div>
                              <div style={{ color: COLORS.muted, fontSize: 11 }}>{relativeTime(event.created_at)}</div>
                            </div>
                          </div>

                          <div style={{ padding: 14 }}>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: summary ? 10 : 0 }}>
                              {[
                                ["Name", safeText(extracted.name)],
                                ["Budget", safeText(extracted.budget_min_lakhs) ? `₹${safeText(extracted.budget_min_lakhs)}–${safeText(extracted.budget_max_lakhs) ?? ""}L` : null],
                                ["Location", safeText(extracted.location)],
                                ["BHK", safeText(extracted.bhk)],
                                ["Intent", safeText(extracted.intent)],
                                ["Timeline", safeText(extracted.timeline)],
                              ].map(([label, value]) => (
                                <div key={label} style={{ background: COLORS.charcoal, borderRadius: 8, padding: 10, border: "1px solid rgba(201,168,76,0.08)" }}>
                                  <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                                  <div style={{ color: COLORS.offWhite, fontSize: 12, fontWeight: 600 }}>{value ?? "—"}</div>
                                </div>
                              ))}
                            </div>

                            {summary && (
                              <div style={{ background: "rgba(201,168,76,0.04)", border: "1px solid rgba(201,168,76,0.15)", borderLeft: `3px solid ${COLORS.darkGold}`, borderRadius: 10, padding: 12, color: COLORS.gold, fontSize: 12, lineHeight: 1.8 }}>
                                {summary}
                              </div>
                            )}

                            {event.transcript && (
                              <details style={{ marginTop: 10 }}>
                                <summary style={{ cursor: "pointer", color: COLORS.gold, fontSize: 13, fontWeight: 600, listStyle: "none" }}>Transcript</summary>
                                <div style={{ marginTop: 10, background: "#050505", border: "1px solid rgba(201,168,76,0.1)", color: COLORS.gold, borderRadius: 8, padding: 16, fontFamily: "monospace", fontSize: 12, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{event.transcript}</div>
                              </details>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
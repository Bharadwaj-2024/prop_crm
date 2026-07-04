import { createClient } from '@supabase/supabase-js'

export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string
  phone: string
  name: string | null
  budget_min: number | null
  budget_max: number | null
  location: string | null
  bhk: string | null
  intent: string | null
  timeline: string | null
  summary: string | null
  stage: string
  last_contact_at: string | null
  created_at: string
}

interface TimelineEvent {
  id: string
  lead_phone: string
  channel: string
  direction: string
  duration_sec: number | null
  transcript: string | null
  extracted_fields: Record<string, unknown> | null
  intent_tag: string | null
  created_at: string
}

// ─── Gold + Dark-Navy color palette ──────────────────────────────────────────
// Primary gold : #f59e0b  Light gold: #fbbf24  Dark gold: #d97706
// Navy bg      : #020b18 → #051a3a → #0a2350
// Card bg      : rgba(245,158,11,0.07)  border: rgba(245,158,11,0.18)

const INTENT: Record<string, { label: string; bg: string; color: string; dot: string; border: string }> = {
  serious_buyer: { label: 'Serious Buyer', bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', dot: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  investor:      { label: 'Investor',      bg: 'rgba(6,182,212,0.12)',  color: '#22d3ee', dot: '#06b6d4', border: 'rgba(6,182,212,0.25)' },
  just_browsing: { label: 'Browsing',      bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', dot: '#64748b', border: 'rgba(148,163,184,0.18)' },
}

const STAGE: Record<string, { label: string; bg: string; color: string; border: string; bar: string }> = {
  new:         { label: 'New',         bg: 'rgba(96,165,250,0.12)',  color: '#60a5fa', border: 'rgba(96,165,250,0.25)',  bar: '#3b82f6' },
  contacted:   { label: 'Contacted',   bg: 'rgba(52,211,153,0.12)',  color: '#34d399', border: 'rgba(52,211,153,0.25)',  bar: '#10b981' },
  site_visit:  { label: 'Site Visit',  bg: 'rgba(245,158,11,0.15)',  color: '#fbbf24', border: 'rgba(245,158,11,0.3)',   bar: '#f59e0b' },
  negotiation: { label: 'Negotiation', bg: 'rgba(251,146,60,0.12)',  color: '#fb923c', border: 'rgba(251,146,60,0.25)',  bar: '#f97316' },
  closed:      { label: 'Closed',      bg: 'rgba(74,222,128,0.12)',  color: '#4ade80', border: 'rgba(74,222,128,0.25)',  bar: '#22c55e' },
}

const TIMELINE_LABELS: Record<string, string> = {
  immediate: 'Immediate', '3_months': '3 Months', '6_months': '6 Months',
  '12_months': '12 Months', unknown: 'Unknown',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

function formatBudget(min: number | null, max: number | null): string {
  if (!min && !max) return '—'
  if (min && max) return `₹${min}–${max}L`
  if (min) return `₹${min}L+`
  return `Up to ₹${max}L`
}

function formatDuration(sec: number | null): string {
  if (!sec) return '0:00'
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

// ─── Reusable pieces ──────────────────────────────────────────────────────────

function Avatar({ name, phone, size = 34 }: { name: string | null; phone: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28), flexShrink: 0,
      background: 'linear-gradient(135deg,#d97706,#f59e0b)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#0a1428', fontSize: size * 0.38, fontWeight: '900',
      boxShadow: '0 2px 10px rgba(245,158,11,0.4)',
    }}>
      {(name ?? phone)[0].toUpperCase()}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function Dashboard() {
  const supabase = getSupabase()

  const [{ data: leadsRaw, error: leadsErr }, { data: eventsRaw, error: eventsErr }] =
    await Promise.all([
      supabase.from('leads').select('*').order('last_contact_at', { ascending: false }),
      supabase.from('timeline_events').select('*').order('created_at', { ascending: false }),
    ])

  if (leadsErr || eventsErr) {
    return (
      <div style={{ minHeight: '100vh', background: '#020b18', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '16px', padding: '2rem', maxWidth: '500px', width: '100%' }}>
          <p style={{ fontSize: '28px', marginBottom: '0.5rem' }}>⚠️</p>
          <h2 style={{ color: '#fbbf24', fontWeight: '800', marginBottom: '0.75rem', fontSize: '18px' }}>Supabase Connection Error</h2>
          <pre style={{ background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: '8px', fontSize: '12px', color: '#fde68a', overflow: 'auto', border: '1px solid rgba(245,158,11,0.15)' }}>
            {JSON.stringify(leadsErr ?? eventsErr, null, 2)}
          </pre>
          <p style={{ marginTop: '1rem', fontSize: '13px', color: 'rgba(255,255,255,0.45)' }}>
            Check <code style={{ color: '#fbbf24' }}>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code style={{ color: '#fbbf24' }}>SUPABASE_SERVICE_ROLE_KEY</code> in <code style={{ color: '#fbbf24' }}>.env.local</code>
          </p>
        </div>
      </div>
    )
  }

  const leads  = (leadsRaw  ?? []) as Lead[]
  const events = (eventsRaw ?? []) as TimelineEvent[]

  const todayStr   = new Date().toDateString()
  const callsToday = events.filter(e => new Date(e.created_at).toDateString() === todayStr).length
  const serious    = leads.filter(l => l.intent === 'serious_buyer').length
  const investors  = leads.filter(l => l.intent === 'investor').length

  const stages      = ['new', 'contacted', 'site_visit', 'negotiation', 'closed']
  const stageCounts = stages.map(s => leads.filter(l => l.stage === s).length)
  const pipeTotal   = leads.length || 1

  const statCards = [
    {
      label: 'Total Leads', value: leads.length,
      sub: `${events.length} total calls`, icon: '👥',
      grad: 'linear-gradient(135deg,#d97706,#f59e0b,#fbbf24)',
      glow: 'rgba(245,158,11,0.35)',
    },
    {
      label: 'Serious Buyers', value: serious,
      sub: leads.length ? `${Math.round((serious / leads.length) * 100)}% of leads` : '—',
      icon: '🔥',
      grad: 'linear-gradient(135deg,#b45309,#d97706)',
      glow: 'rgba(217,119,6,0.3)',
    },
    {
      label: 'Investors', value: investors,
      sub: leads.length ? `${Math.round((investors / leads.length) * 100)}% of leads` : '—',
      icon: '💼',
      grad: 'linear-gradient(135deg,#0369a1,#0ea5e9)',
      glow: 'rgba(14,165,233,0.3)',
    },
    {
      label: 'Calls Today', value: callsToday,
      sub: `${events.length} all-time`, icon: '📞',
      grad: 'linear-gradient(135deg,#1d4ed8,#3b82f6)',
      glow: 'rgba(59,130,246,0.3)',
    },
  ]

  // Shared glass card style
  const card = {
    background: 'rgba(245,158,11,0.05)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(245,158,11,0.15)',
    borderRadius: '18px',
  } as const

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#020b18 0%,#051a3a 50%,#0a2350 100%)', fontFamily: "'Inter',sans-serif" }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, width: '72px',
        background: 'rgba(2,11,24,0.96)', backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(245,158,11,0.12)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: '1.25rem', gap: '6px', zIndex: 40,
      }}>
        {/* Logo */}
        <div style={{
          width: '44px', height: '44px', borderRadius: '14px', marginBottom: '1.5rem',
          background: 'linear-gradient(135deg,#d97706,#f59e0b)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px',
          boxShadow: '0 0 28px rgba(245,158,11,0.55)',
        }}>📞</div>

        {[
          { icon: '🏠', label: 'Dashboard', active: true },
          { icon: '👥', label: 'Leads' },
          { icon: '📊', label: 'Analytics' },
          { icon: '⚙️', label: 'Settings' },
        ].map(item => (
          <div key={item.label} title={item.label} style={{
            width: '44px', height: '44px', borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '19px', cursor: 'pointer', position: 'relative',
            background: item.active ? 'rgba(245,158,11,0.18)' : 'transparent',
            border: item.active ? '1px solid rgba(245,158,11,0.35)' : '1px solid transparent',
          }}>
            {item.icon}
            {item.active && (
              <span style={{
                position: 'absolute', right: '-4px', top: '50%', transform: 'translateY(-50%)',
                width: '3px', height: '20px', background: '#f59e0b', borderRadius: '999px',
                boxShadow: '0 0 8px rgba(245,158,11,0.8)',
              }} />
            )}
          </div>
        ))}

        <span style={{
          position: 'absolute', bottom: '1.25rem',
          fontSize: '9px', color: 'rgba(245,158,11,0.25)',
          fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase',
          writingMode: 'vertical-rl', transform: 'rotate(180deg)',
        }}>CRM v1</span>
      </nav>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main style={{ marginLeft: '72px', padding: '2rem', animation: 'fade-up 0.35s ease' }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
          <div>
            <h1 style={{
              margin: '0 0 6px', fontSize: '30px', fontWeight: '900', letterSpacing: '-0.03em',
              background: 'linear-gradient(135deg,#fbbf24 0%,#f59e0b 50%,#d97706 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              Call Intelligence CRM
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block',
                background: '#22c55e', boxShadow: '0 0 6px #22c55e',
                animation: 'pulse-ring 2s ease infinite',
              }} />
              <span style={{ fontSize: '12px', color: 'rgba(245,158,11,0.55)', fontWeight: '600' }}>
                Live · {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          <div style={{
            ...card,
            padding: '10px 18px',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ fontSize: '13px', color: 'rgba(245,158,11,0.7)', fontWeight: '600' }}>
              {leads.length} leads &nbsp;·&nbsp; {events.length} calls
            </span>
          </div>
        </div>

        {/* ── Stat cards ──────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
          {statCards.map(c => (
            <div key={c.label} style={{ ...card, padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
              {/* ambient glow blob */}
              <div style={{
                position: 'absolute', right: '-22px', top: '-22px',
                width: '90px', height: '90px', borderRadius: '50%',
                background: c.grad, opacity: 0.18, filter: 'blur(22px)',
                pointerEvents: 'none',
              }} />
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px', marginBottom: '1.1rem',
                background: c.grad, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '22px', boxShadow: `0 4px 16px ${c.glow}`,
              }}>
                {c.icon}
              </div>
              <p style={{ fontSize: '36px', fontWeight: '900', color: '#fff', lineHeight: 1, letterSpacing: '-0.04em', margin: '0 0 4px' }}>
                {c.value}
              </p>
              <p style={{ fontSize: '13px', color: 'rgba(245,158,11,0.65)', fontWeight: '700', margin: '0 0 2px' }}>
                {c.label}
              </p>
              <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.28)', margin: 0 }}>
                {c.sub}
              </p>
            </div>
          ))}
        </div>

        {/* ── Pipeline bar ────────────────────────────────────────────────── */}
        {leads.length > 0 && (
          <div style={{ ...card, padding: '1.4rem', marginBottom: '1.25rem' }}>
            <p style={{ margin: '0 0 0.9rem', fontSize: '11px', fontWeight: '700', color: 'rgba(245,158,11,0.5)', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
              ✦ Lead Pipeline
            </p>
            <div style={{ display: 'flex', gap: '3px', height: '10px', borderRadius: '999px', overflow: 'hidden', marginBottom: '0.85rem', background: 'rgba(255,255,255,0.05)' }}>
              {stages.map((s, i) => {
                const pct = (stageCounts[i] / pipeTotal) * 100
                return pct > 0 ? (
                  <div key={s} title={`${STAGE[s]?.label}: ${stageCounts[i]}`}
                    style={{ flex: pct, background: STAGE[s]?.bar ?? '#64748b' }} />
                ) : null
              })}
            </div>
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap' }}>
              {stages.map((s, i) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: STAGE[s]?.bar ?? '#64748b', display: 'inline-block' }} />
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: '500' }}>
                    {STAGE[s]?.label} <strong style={{ color: '#fbbf24' }}>{stageCounts[i]}</strong>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Leads table ─────────────────────────────────────────────────── */}
        <div style={{ ...card, overflow: 'hidden', marginBottom: '1.25rem' }}>
          <div style={{
            padding: '1.1rem 1.5rem',
            borderBottom: '1px solid rgba(245,158,11,0.12)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#fbbf24' }}>
              All Leads
            </h2>
            <span style={{
              fontSize: '11px', fontWeight: '700', color: '#d97706',
              background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
              padding: '3px 12px', borderRadius: '999px',
            }}>
              {leads.length} total
            </span>
          </div>

          {leads.length === 0 ? (
            <div style={{ padding: '5rem', textAlign: 'center' }}>
              <p style={{ fontSize: '48px', margin: '0 0 1rem' }}>📭</p>
              <p style={{ fontWeight: '700', color: 'rgba(245,158,11,0.5)', margin: '0 0 4px' }}>No leads yet</p>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)', margin: 0 }}>Make a call and data will appear automatically</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(245,158,11,0.1)' }}>
                    {['Lead', 'Budget', 'Location', 'BHK', 'Intent', 'Timeline', 'Stage', 'Last Call'].map(h => (
                      <th key={h} style={{
                        padding: '11px 16px', textAlign: 'left',
                        fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                        letterSpacing: '0.08em', color: 'rgba(245,158,11,0.45)', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, i) => {
                    const intent = INTENT[lead.intent ?? ''] ?? INTENT.just_browsing
                    const stage  = STAGE[lead.stage]  ?? STAGE.new
                    return (
                      <tr key={lead.id} style={{
                        borderBottom: '1px solid rgba(245,158,11,0.06)',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(245,158,11,0.025)',
                      }}>
                        {/* Lead */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Avatar name={lead.name} phone={lead.phone} size={34} />
                            <div>
                              <p style={{ margin: 0, fontWeight: '700', fontSize: '13px', color: lead.name ? '#fff' : 'rgba(255,255,255,0.3)' }}>
                                {lead.name ?? 'Unknown'}
                              </p>
                              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(245,158,11,0.4)' }}>
                                {lead.phone}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Budget */}
                        <td style={{ padding: '14px 16px', fontWeight: '700', color: '#fbbf24', whiteSpace: 'nowrap' }}>
                          {formatBudget(lead.budget_min, lead.budget_max)}
                        </td>

                        {/* Location */}
                        <td style={{ padding: '14px 16px', color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap' }}>
                          {lead.location
                            ? <span>📍 {lead.location}</span>
                            : <span style={{ color: 'rgba(255,255,255,0.18)' }}>—</span>}
                        </td>

                        {/* BHK */}
                        <td style={{ padding: '14px 16px' }}>
                          {lead.bhk
                            ? <span style={{ padding: '3px 10px', borderRadius: '7px', fontSize: '11px', fontWeight: '700', background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.22)' }}>{lead.bhk}</span>
                            : <span style={{ color: 'rgba(255,255,255,0.18)' }}>—</span>}
                        </td>

                        {/* Intent */}
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap',
                            padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '700',
                            background: intent.bg, color: intent.color, border: `1px solid ${intent.border}`,
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: intent.dot, flexShrink: 0 }} />
                            {intent.label}
                          </span>
                        </td>

                        {/* Timeline */}
                        <td style={{ padding: '14px 16px' }}>
                          {lead.timeline
                            ? <span style={{ padding: '4px 10px', borderRadius: '7px', fontSize: '11px', fontWeight: '600', background: 'rgba(14,165,233,0.12)', color: '#38bdf8', border: '1px solid rgba(14,165,233,0.2)' }}>
                                {TIMELINE_LABELS[lead.timeline] ?? lead.timeline}
                              </span>
                            : <span style={{ color: 'rgba(255,255,255,0.18)' }}>—</span>}
                        </td>

                        {/* Stage */}
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{
                            padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap',
                            background: stage.bg, color: stage.color, border: `1px solid ${stage.border}`,
                          }}>
                            {stage.label}
                          </span>
                        </td>

                        {/* Last call */}
                        <td style={{ padding: '14px 16px', color: 'rgba(245,158,11,0.4)', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                          {relativeTime(lead.last_contact_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Call Events ─────────────────────────────────────────────────── */}
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{
            padding: '1.1rem 1.5rem',
            borderBottom: '1px solid rgba(245,158,11,0.12)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#fbbf24' }}>
              Call Transcripts &amp; AI Data
            </h2>
            <span style={{
              fontSize: '11px', fontWeight: '700', color: '#d97706',
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.22)',
              padding: '3px 12px', borderRadius: '999px',
            }}>
              {events.length} events
            </span>
          </div>

          {events.length === 0 ? (
            <div style={{ padding: '4rem', textAlign: 'center' }}>
              <p style={{ fontSize: '42px', margin: '0 0 0.75rem' }}>🎙️</p>
              <p style={{ fontWeight: '600', color: 'rgba(245,158,11,0.4)', margin: 0 }}>No call recordings yet</p>
            </div>
          ) : (
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {events.map(event => {
                const isIn   = event.direction === 'inbound'
                const ef     = event.extracted_fields as Record<string, unknown> | null
                const efSummary = ef?.summary != null ? String(ef.summary) : null

                return (
                  <div key={event.id} style={{
                    border: '1px solid rgba(245,158,11,0.12)',
                    borderRadius: '14px', overflow: 'hidden',
                    background: 'rgba(245,158,11,0.03)',
                  }}>
                    {/* Event header */}
                    <div style={{
                      padding: '0.9rem 1.1rem',
                      background: 'rgba(245,158,11,0.05)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderBottom: '1px solid rgba(245,158,11,0.08)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '10px', fontSize: '16px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isIn ? 'rgba(52,211,153,0.15)' : 'rgba(245,158,11,0.15)',
                          border: `1px solid ${isIn ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)'}`,
                        }}>
                          {isIn ? '📲' : '📤'}
                        </div>
                        <div>
                          <p style={{ margin: 0, fontWeight: '700', color: '#fff', fontSize: '13px' }}>
                            {event.lead_phone}
                          </p>
                          <p style={{ margin: 0, fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', color: isIn ? '#34d399' : '#fbbf24' }}>
                            {event.direction} · {event.channel}
                          </p>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontWeight: '700', color: '#fbbf24', fontSize: '13px' }}>
                          ⏱ {formatDuration(event.duration_sec)}
                        </p>
                        <p style={{ margin: 0, fontSize: '11px', color: 'rgba(245,158,11,0.4)' }}>
                          {new Date(event.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    {/* Extracted fields */}
                    {ef && (
                      <div style={{ padding: '1rem 1.1rem' }}>
                        <p style={{ margin: '0 0 0.65rem', fontSize: '10px', fontWeight: '700', color: 'rgba(245,158,11,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          🤖 AI Extracted
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem', marginBottom: efSummary ? '0.75rem' : 0 }}>
                          {([
                            ['👤 Name',     ef.name     != null ? String(ef.name)     : null],
                            ['💰 Budget',   ef.budget_min_lakhs != null
                              ? `₹${ef.budget_min_lakhs}–${ef.budget_max_lakhs}L` : null],
                            ['📍 Location', ef.location != null ? String(ef.location) : null],
                            ['🏠 BHK',      ef.bhk      != null ? String(ef.bhk)      : null],
                            ['🎯 Intent',   ef.intent   != null ? String(ef.intent)   : null],
                            ['⏳ Timeline', ef.timeline != null ? String(ef.timeline) : null],
                          ] as [string, string | null][]).map(([label, value]) => (
                            <div key={label} style={{
                              padding: '0.5rem 0.65rem',
                              background: 'rgba(245,158,11,0.06)',
                              borderRadius: '8px',
                              border: '1px solid rgba(245,158,11,0.1)',
                            }}>
                              <p style={{ margin: '0 0 1px', fontSize: '9px', color: 'rgba(245,158,11,0.4)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {label}
                              </p>
                              <p style={{ margin: 0, fontSize: '12px', fontWeight: '700', color: value ? '#fff' : 'rgba(255,255,255,0.2)' }}>
                                {value ?? '—'}
                              </p>
                            </div>
                          ))}
                        </div>

                        {/* ── FIX: cast summary to string before rendering ── */}
                        {efSummary && (
                          <div style={{
                            padding: '0.75rem 1rem',
                            background: 'rgba(245,158,11,0.1)',
                            borderRadius: '10px',
                            border: '1px solid rgba(245,158,11,0.25)',
                          }}>
                            <p style={{ margin: 0, fontSize: '12px', color: '#fde68a', lineHeight: '1.75' }}>
                              📝 {efSummary}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Transcript */}
                    {event.transcript && (
                      <div style={{ borderTop: '1px solid rgba(245,158,11,0.08)', padding: '0.75rem 1.1rem' }}>
                        <details>
                          <summary style={{
                            cursor: 'pointer', fontSize: '12px', fontWeight: '700',
                            color: '#f59e0b', userSelect: 'none',
                            display: 'flex', alignItems: 'center', gap: '6px',
                          }}>
                            <span>📄</span> View Full Transcript
                          </summary>
                          <div style={{
                            marginTop: '0.75rem',
                            background: '#020b18',
                            borderRadius: '10px',
                            padding: '1rem',
                            fontSize: '12px', color: '#fde68a',
                            lineHeight: '1.9', whiteSpace: 'pre-wrap',
                            fontFamily: "'Fira Code','Courier New',monospace",
                            maxHeight: '260px', overflowY: 'auto',
                            border: '1px solid rgba(245,158,11,0.15)',
                          }}>
                            {event.transcript}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: '11px', fontWeight: '600', marginTop: '2rem', color: 'rgba(245,158,11,0.25)', letterSpacing: '0.04em' }}>
          ✦ Call Intelligence CRM &nbsp;·&nbsp; AI-powered real estate lead intelligence ✦
        </p>
      </main>
    </div>
  )
}

'use client'

import { createClient } from '@supabase/supabase-js'
import { useState, useEffect, useCallback } from 'react'

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
  last_whatsapp_at: string | null
  preferred_channel: string | null
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

// ─── Config ───────────────────────────────────────────────────────────────────

const INTENT: Record<string, { label: string; bg: string; color: string; dot: string; border: string }> = {
  serious_buyer: { label: 'Serious Buyer', bg: 'rgba(22,163,74,0.12)',  color: '#16a34a', dot: '#16a34a', border: 'rgba(22,163,74,0.25)' },
  investor:      { label: 'Investor',       bg: 'rgba(217,119,6,0.12)',  color: '#d97706', dot: '#d97706', border: 'rgba(217,119,6,0.25)' },
  just_browsing: { label: 'Browsing',       bg: 'rgba(100,116,139,0.12)', color: '#64748b', dot: '#94a3b8', border: 'rgba(100,116,139,0.2)' },
}

const STAGE: Record<string, { label: string; color: string; bar: string }> = {
  new:         { label: 'New',         color: '#2563eb', bar: '#3b82f6' },
  contacted:   { label: 'Contacted',   color: '#059669', bar: '#10b981' },
  site_visit:  { label: 'Site Visit',  color: '#d97706', bar: '#f59e0b' },
  negotiation: { label: 'Negotiation', color: '#7c3aed', bar: '#a855f7' },
  closed:      { label: 'Closed',      color: '#15803d', bar: '#22c55e' },
}

const TIMELINE_LABELS: Record<string, string> = {
  immediate: 'Immediate', '3_months': '3 Mo', '6_months': '6 Mo', '12_months': '12 Mo', unknown: '?',
}

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

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ─── Lead Detail Modal ────────────────────────────────────────────────────────

function LeadModal({
  lead,
  events,
  onClose,
}: {
  lead: Lead
  events: TimelineEvent[]
  onClose: () => void
}) {
  const [replyMsg, setReplyMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const leadEvents = events
    .filter(e => e.lead_phone === lead.phone)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  async function sendReply() {
    if (!replyMsg.trim()) return
    setSending(true)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: lead.phone, message: replyMsg }),
      })
      if (res.ok) {
        setSent(true)
        setReplyMsg('')
        setTimeout(() => setSent(false), 3000)
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'linear-gradient(160deg,#1a1740,#252050)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '20px', padding: '1.75rem',
          width: '580px', maxWidth: '95vw', maxHeight: '85vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '800', color: '#fff' }}>
              {lead.name ?? 'Unknown'}
            </h2>
            <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{lead.phone}</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', color: '#fff', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >×</button>
        </div>

        {/* Lead summary */}
        {lead.summary && (
          <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.75rem 1rem', marginBottom: '1.25rem', fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
            {lead.summary}
          </div>
        )}

        {/* Quick facts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem', marginBottom: '1.25rem' }}>
          {[
            { label: 'Budget', value: formatBudget(lead.budget_min, lead.budget_max) },
            { label: 'Location', value: lead.location ?? '—' },
            { label: 'BHK', value: lead.bhk ?? '—' },
          ].map(f => (
            <div key={f.label} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '0.65rem 0.85rem' }}>
              <p style={{ margin: '0 0 2px', fontSize: '10px', fontWeight: '700', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>{f.label}</p>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: '700', color: '#fff' }}>{f.value}</p>
            </div>
          ))}
        </div>

        {/* WhatsApp reply box */}
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={{ margin: '0 0 8px', fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            💬 Reply on WhatsApp
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={replyMsg}
              onChange={e => setReplyMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()}
              placeholder="Type a message..."
              style={{
                flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '10px', padding: '0.6rem 0.9rem', color: '#fff', fontSize: '13px',
                outline: 'none',
              }}
            />
            <button
              onClick={sendReply}
              disabled={sending || !replyMsg.trim()}
              style={{
                padding: '0 1.1rem', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '12px',
                background: sent ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,#25d366,#128c7e)',
                color: '#fff', opacity: sending || !replyMsg.trim() ? 0.5 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {sent ? '✓ Sent' : sending ? '...' : 'Send'}
            </button>
          </div>
        </div>

        {/* Timeline */}
        <p style={{ margin: '0 0 0.75rem', fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Timeline ({leadEvents.length})
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {leadEvents.length === 0 && (
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px', margin: 0 }}>No events yet</p>
          )}
          {leadEvents.map(ev => {
            const isWA = ev.channel === 'whatsapp'
            return (
              <div
                key={ev.id}
                style={{
                  background: isWA ? 'rgba(37,211,102,0.08)' : 'rgba(59,130,246,0.08)',
                  border: `1px solid ${isWA ? 'rgba(37,211,102,0.2)' : 'rgba(59,130,246,0.2)'}`,
                  borderRadius: '10px', padding: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: ev.transcript ? '6px' : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14px' }}>{isWA ? '💬' : '📞'}</span>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: isWA ? '#25d366' : '#60a5fa' }}>
                      {isWA ? 'WhatsApp' : 'Call'} · {ev.direction}
                    </span>
                    {ev.duration_sec != null && ev.duration_sec > 0 && (
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                        {Math.floor(ev.duration_sec / 60)}:{String(ev.duration_sec % 60).padStart(2, '0')}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>
                    {relativeTime(ev.created_at)}
                  </span>
                </div>
                {ev.transcript && (
                  <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                    {ev.transcript.length > 200 ? ev.transcript.slice(0, 200) + '…' : ev.transcript}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [channelFilter, setChannelFilter] = useState<'all' | 'call' | 'whatsapp'>('all')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [now, setNow] = useState('')

  const fetchData = useCallback(async () => {
    const supabase = getSupabaseClient()
    const [{ data: leadsRaw, error: leadsErr }, { data: eventsRaw, error: eventsErr }] =
      await Promise.all([
        supabase.from('leads').select('*').order('last_contact_at', { ascending: false }),
        supabase.from('timeline_events').select('*').order('created_at', { ascending: false }),
      ])

    if (leadsErr || eventsErr) {
      setError(JSON.stringify(leadsErr ?? eventsErr, null, 2))
      return
    }
    setLeads((leadsRaw ?? []) as Lead[])
    setEvents((eventsRaw ?? []) as TimelineEvent[])
  }, [])

  useEffect(() => {
    fetchData()
    setNow(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))
    const timer = setInterval(() => {
      setNow(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }))
    }, 60000)
    return () => clearInterval(timer)
  }, [fetchData])

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f0f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: '16px', padding: '2rem', maxWidth: '480px', width: '100%' }}>
          <p style={{ fontSize: '22px', marginBottom: '0.5rem' }}>⚠️</p>
          <h2 style={{ color: '#dc2626', fontWeight: '700', marginBottom: '0.75rem' }}>Connection Error</h2>
          <pre style={{ background: '#fef2f2', padding: '1rem', borderRadius: '8px', fontSize: '12px', color: '#991b1b', overflow: 'auto' }}>
            {error}
          </pre>
        </div>
      </div>
    )
  }

  const todayStr = new Date().toDateString()
  const callsToday = events.filter(e => e.channel === 'call' && new Date(e.created_at).toDateString() === todayStr).length
  const waToday    = events.filter(e => e.channel === 'whatsapp' && new Date(e.created_at).toDateString() === todayStr).length
  const serious    = leads.filter(l => l.intent === 'serious_buyer').length
  const investors  = leads.filter(l => l.intent === 'investor').length

  // Channel-filtered leads
  const filteredLeads = leads.filter(lead => {
    if (channelFilter === 'all') return true
    const leadPhones = new Set(events.filter(e => e.channel === channelFilter).map(e => e.lead_phone))
    return leadPhones.has(lead.phone)
  })

  const stages = ['new', 'contacted', 'site_visit', 'negotiation', 'closed']
  const stageCounts = stages.map(s => leads.filter(l => l.stage === s).length)
  const pipeTotal = leads.length || 1

  const statCards = [
    { label: 'Total Leads',        value: leads.length, icon: '👥', grad: 'linear-gradient(135deg,#4f46e5,#7c3aed)', glow: 'rgba(79,70,229,0.25)' },
    { label: 'Serious Buyers',     value: serious,       icon: '🔥', grad: 'linear-gradient(135deg,#059669,#10b981)', glow: 'rgba(5,150,105,0.25)' },
    { label: 'Investors',          value: investors,     icon: '💼', grad: 'linear-gradient(135deg,#d97706,#f59e0b)', glow: 'rgba(217,119,6,0.25)' },
    { label: 'Calls Today',        value: callsToday,    icon: '📞', grad: 'linear-gradient(135deg,#dc2626,#ef4444)', glow: 'rgba(220,38,38,0.25)' },
    { label: 'WhatsApp Today',     value: waToday,       icon: '💬', grad: 'linear-gradient(135deg,#25d366,#128c7e)', glow: 'rgba(37,211,102,0.25)' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0f0c29,#302b63,#24243e)', fontFamily: "'Inter',sans-serif" }}>

      {/* Sidebar */}
      <nav style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, width: '68px',
        background: 'rgba(15,12,41,0.92)', backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: '1.25rem', gap: '5px', zIndex: 40,
      }}>
        <div style={{
          width: '42px', height: '42px', borderRadius: '13px', marginBottom: '1.25rem',
          background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
          boxShadow: '0 0 20px rgba(79,70,229,0.55)',
        }}>📞</div>

        {[
          { icon: '📊', label: 'Dashboard', active: true },
          { icon: '👥', label: 'Leads' },
          { icon: '📈', label: 'Analytics' },
          { icon: '⚙️', label: 'Settings' },
        ].map(item => (
          <div key={item.label} title={item.label} style={{
            width: '42px', height: '42px', borderRadius: '11px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', cursor: 'pointer', position: 'relative',
            background: item.active ? 'rgba(79,70,229,0.35)' : 'transparent',
            border: item.active ? '1px solid rgba(99,102,241,0.4)' : '1px solid transparent',
          }}>
            {item.icon}
            {item.active && (
              <span style={{
                position: 'absolute', right: '-3px', top: '50%', transform: 'translateY(-50%)',
                width: '3px', height: '16px', background: '#818cf8', borderRadius: '999px',
              }} />
            )}
          </div>
        ))}
      </nav>

      {/* Main */}
      <main style={{ marginLeft: '68px', padding: '2rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div>
            <h1 style={{
              margin: '0 0 5px', fontSize: '26px', fontWeight: '900', letterSpacing: '-0.03em',
              background: 'linear-gradient(135deg,#fff 0%,#c7d2fe 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              Dashboard
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: '500' }}>
                Live · {now}
              </span>
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px',
            padding: '8px 16px', fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontWeight: '600',
          }}>
            📞 CallCRM &nbsp;·&nbsp; {leads.length} leads
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
          {statCards.map(card => (
            <div key={card.label} style={{
              background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.09)', borderRadius: '18px',
              padding: '1.4rem', position: 'relative', overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', right: '-18px', top: '-18px',
                width: '80px', height: '80px', borderRadius: '50%',
                background: card.grad, opacity: 0.15, filter: 'blur(18px)',
              }} />
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px', marginBottom: '1rem',
                background: card.grad, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '19px', boxShadow: `0 4px 14px ${card.glow}`,
              }}>{card.icon}</div>
              <p style={{ fontSize: '32px', fontWeight: '900', color: '#fff', lineHeight: 1, letterSpacing: '-0.03em', margin: '0 0 5px' }}>
                {card.value}
              </p>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontWeight: '600', margin: 0 }}>
                {card.label}
              </p>
            </div>
          ))}
        </div>

        {/* Pipeline */}
        {leads.length > 0 && (
          <div style={{
            background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.09)', borderRadius: '18px',
            padding: '1.4rem', marginBottom: '1.25rem',
          }}>
            <p style={{ margin: '0 0 0.9rem', fontSize: '11px', fontWeight: '700', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Pipeline
            </p>
            <div style={{ display: 'flex', gap: '3px', height: '8px', borderRadius: '999px', overflow: 'hidden', marginBottom: '0.85rem' }}>
              {stages.map((s, i) => {
                const pct = (stageCounts[i] / pipeTotal) * 100
                return pct > 0 ? (
                  <div key={s} title={`${STAGE[s]?.label}: ${stageCounts[i]}`}
                    style={{ flex: pct, background: STAGE[s]?.bar ?? '#64748b' }} />
                ) : null
              })}
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              {stages.map((s, i) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '2px', background: STAGE[s]?.bar ?? '#64748b', display: 'inline-block' }} />
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', fontWeight: '500' }}>
                    {STAGE[s]?.label} <strong style={{ color: '#fff' }}>{stageCounts[i]}</strong>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leads table */}
        <div style={{
          background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.09)', borderRadius: '18px',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '1.1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#fff' }}>All Leads</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Channel filter */}
              {(['all', 'call', 'whatsapp'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setChannelFilter(f)}
                  style={{
                    padding: '4px 12px', borderRadius: '999px', border: 'none', cursor: 'pointer',
                    fontSize: '11px', fontWeight: '700',
                    background: channelFilter === f ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                    color: channelFilter === f ? '#fff' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {f === 'all' ? 'All' : f === 'call' ? '📞 Calls' : '💬 WhatsApp'}
                </button>
              ))}
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.08)', padding: '3px 10px', borderRadius: '999px', fontWeight: '600' }}>
                {filteredLeads.length} total
              </span>
            </div>
          </div>

          {filteredLeads.length === 0 ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
              <p style={{ fontSize: '40px', margin: '0 0 0.75rem' }}>📭</p>
              <p style={{ fontWeight: '600', color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                {channelFilter === 'all' ? 'No leads yet — make a call or send a WhatsApp to get started' : `No ${channelFilter} leads yet`}
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    {['Lead', 'Channel', 'Budget', 'Location', 'BHK', 'Intent', 'Timeline', 'Stage', 'Last Contact'].map(h => (
                      <th key={h} style={{
                        padding: '10px 14px', textAlign: 'left',
                        fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
                        letterSpacing: '0.07em', color: 'rgba(255,255,255,0.28)', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead, i) => {
                    const intent = INTENT[lead.intent ?? ''] ?? INTENT.just_browsing
                    const stage  = STAGE[lead.stage] ?? STAGE.new
                    const ch     = (lead.name ?? lead.phone)[0].toUpperCase()
                    const leadEvents = events.filter(e => e.lead_phone === lead.phone)
                    const hasWA   = leadEvents.some(e => e.channel === 'whatsapp')
                    const hasCall = leadEvents.some(e => e.channel === 'call')
                    return (
                      <tr
                        key={lead.id}
                        onClick={() => setSelectedLead(lead)}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                          cursor: 'pointer',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                        onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)')}
                      >
                        {/* Lead */}
                        <td style={{ padding: '13px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                            <div style={{
                              width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
                              background: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#fff', fontSize: '12px', fontWeight: '800',
                              boxShadow: '0 2px 6px rgba(79,70,229,0.3)',
                            }}>{ch}</div>
                            <div>
                              <p style={{ margin: 0, fontWeight: '700', color: lead.name ? '#fff' : 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                                {lead.name ?? 'Unknown'}
                              </p>
                              <p style={{ margin: 0, fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>{lead.phone}</p>
                            </div>
                          </div>
                        </td>

                        {/* Channel icons */}
                        <td style={{ padding: '13px 14px' }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            {hasCall && <span title="Call" style={{ fontSize: '14px' }}>📞</span>}
                            {hasWA   && <span title="WhatsApp" style={{ fontSize: '14px' }}>💬</span>}
                          </div>
                        </td>

                        {/* Budget */}
                        <td style={{ padding: '13px 14px', fontWeight: '700', color: '#fff', whiteSpace: 'nowrap' }}>
                          {formatBudget(lead.budget_min, lead.budget_max)}
                        </td>

                        {/* Location */}
                        <td style={{ padding: '13px 14px', color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap' }}>
                          {lead.location ? `📍 ${lead.location}` : <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>}
                        </td>

                        {/* BHK */}
                        <td style={{ padding: '13px 14px' }}>
                          {lead.bhk ? (
                            <span style={{ padding: '3px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', background: 'rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.1)' }}>
                              {lead.bhk}
                            </span>
                          ) : <span style={{ color: 'rgba(255,255,255,0.18)' }}>—</span>}
                        </td>

                        {/* Intent */}
                        <td style={{ padding: '13px 14px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap',
                            padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: '700',
                            background: intent.bg, color: intent.color, border: `1px solid ${intent.border}`,
                          }}>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: intent.dot, flexShrink: 0 }} />
                            {intent.label}
                          </span>
                        </td>

                        {/* Timeline */}
                        <td style={{ padding: '13px 14px' }}>
                          {lead.timeline ? (
                            <span style={{ padding: '3px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', background: 'rgba(99,102,241,0.18)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.2)' }}>
                              {TIMELINE_LABELS[lead.timeline] ?? lead.timeline}
                            </span>
                          ) : <span style={{ color: 'rgba(255,255,255,0.18)' }}>—</span>}
                        </td>

                        {/* Stage */}
                        <td style={{ padding: '13px 14px' }}>
                          <span style={{
                            padding: '3px 9px', borderRadius: '999px', fontSize: '11px', fontWeight: '700', whiteSpace: 'nowrap',
                            background: `${stage.bar}22`, color: stage.color,
                            border: `1px solid ${stage.bar}44`,
                          }}>
                            {stage.label}
                          </span>
                        </td>

                        {/* Last contact */}
                        <td style={{ padding: '13px 14px', color: 'rgba(255,255,255,0.35)', fontSize: '12px', fontWeight: '500', whiteSpace: 'nowrap' }}>
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

        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.15)', fontSize: '11px', fontWeight: '500', marginTop: '1.75rem' }}>
          Call Intelligence CRM · AI-powered real estate leads
        </p>
      </main>

      {/* Lead detail modal */}
      {selectedLead && (
        <LeadModal
          lead={selectedLead}
          events={events}
          onClose={() => setSelectedLead(null)}
        />
      )}
    </div>
  )
}

"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/lib/hooks/use-toast"
import { authFetch } from "@/lib/auth/apiClient"
import {
  Phone,
  MessageSquare,
  Users,
  TrendingUp,
  Briefcase,
  PhoneCall,
  RefreshCw,
  LogOut,
  Search,
  Copy,
  CheckCircle2,
  Clock,
  MapPin,
  Home,
  ChevronDown,
  Loader2,
  AlertCircle,
  IndianRupee,
  Calendar,
  Target,
} from "lucide-react"

type Lead = {
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

type TimelineEvent = {
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

function formatBudget(min: number | null, max: number | null): string {
  if (!min && !max) return "—"
  if (min && max) return `₹${min}–${max}L`
  if (min) return `₹${min}L+`
  return `Up to ₹${max}L`
}

function formatDuration(sec: number | null): string {
  if (!sec) return "0:00"
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "—"
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return days === 1 ? "yesterday" : `${days}d ago`
}

function safeText(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return null
}

function Avatar({ name, phone }: { name: string | null; phone: string }) {
  const letter = (name ?? phone)[0].toUpperCase()
  return (
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#A07830] flex items-center justify-center text-[#0A0A0A] text-sm font-bold flex-shrink-0 shadow-md">
      {letter}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [leads, setLeads] = useState<Lead[]>([])
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [channelFilter, setChannelFilter] = useState<"all" | "call" | "whatsapp">("all")
  const [intentFilter, setIntentFilter] = useState<"all" | "serious_buyer" | "investor" | "just_browsing">("all")
  const [stageFilter, setStageFilter] = useState<"all" | "new" | "contacted" | "site_visit" | "negotiation" | "closed">("all")
  const [query, setQuery] = useState("")
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")
  const [replySending, setReplySending] = useState(false)
  const [replySent, setReplySent] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await authFetch("/api/dashboard/data", {
        cache: "no-store",
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : JSON.stringify(data.error ?? data, null, 2))
        setLoading(false)
        return
      }
      setLeads((data.leads ?? []) as Lead[])
      setEvents((data.events ?? []) as TimelineEvent[])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error — is the dev server running?")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const t = setInterval(fetchData, 30000)
    return () => clearInterval(t)
  }, [fetchData])

  const todayStr = new Date().toDateString()
  const callsToday = events.filter((e) => e.channel === "call" && new Date(e.created_at).toDateString() === todayStr).length
  const waToday = events.filter((e) => e.channel === "whatsapp" && new Date(e.created_at).toDateString() === todayStr).length
  const serious = leads.filter((l) => l.intent === "serious_buyer").length
  const investors = leads.filter((l) => l.intent === "investor").length

  const filteredLeads = useMemo(() => {
    const phones = channelFilter === "all" ? null : new Set(events.filter((e) => e.channel === channelFilter).map((e) => e.lead_phone))
    return leads.filter((lead) => {
      const matchSearch = !query || [lead.name, lead.phone, lead.location, lead.bhk, lead.summary].filter(Boolean).some((f) => String(f).toLowerCase().includes(query.toLowerCase()))
      const matchChannel = !phones || phones.has(lead.phone)
      const matchIntent = intentFilter === "all" || lead.intent === intentFilter
      const matchStage = stageFilter === "all" || lead.stage === stageFilter
      return matchSearch && matchChannel && matchIntent && matchStage
    })
  }, [channelFilter, events, intentFilter, leads, query, stageFilter])

  const selectedEvents = useMemo(
    () => events.filter((e) => e.lead_phone === selectedLead?.phone).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [events, selectedLead]
  )

  async function copyPhone(phone: string) {
    try {
      await navigator.clipboard.writeText(phone)
      setCopiedPhone(phone)
      setTimeout(() => setCopiedPhone(null), 1200)
      toast({ title: "Copied!", description: phone })
    } catch {
      setCopiedPhone(null)
      toast({ title: "Failed to copy", description: "Please copy manually", variant: "destructive" })
    }
  }

  async function sendReply() {
    if (!selectedLead || !replyText.trim()) return
    setReplySending(true)
    try {
      const res = await authFetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: selectedLead.phone, message: replyText }),
      })
      if (res.ok) {
        setReplySent(true)
        setReplyText("")
        setTimeout(() => setReplySent(false), 2000)
        toast({ title: "Message sent!", description: `WhatsApp reply sent to ${selectedLead.phone}` })
      } else {
        toast({ title: "Failed to send", description: "WhatsApp reply could not be delivered", variant: "destructive" })
      }
    } catch {
      toast({ title: "Network error", description: "Could not reach WhatsApp API", variant: "destructive" })
    } finally {
      setReplySending(false)
    }
  }

  async function handleSignOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" })
    } finally {
      sessionStorage.removeItem("access_token")
      sessionStorage.removeItem("broker")
      document.cookie = "session_token=; path=/; max-age=0; SameSite=Lax"
      document.cookie = "refresh_token=; path=/; max-age=0; SameSite=Lax"
      router.push("/")
      router.refresh()
    }
  }

  const statCards = [
    { label: "Total Leads", value: leads.length, sub: `${events.length} total events`, icon: Users, color: "text-[#C9A84C]", bg: "bg-[#C9A84C]/10" },
    { label: "Serious Buyers", value: serious, sub: leads.length ? `${Math.round((serious / leads.length) * 100)}% of leads` : "—", icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { label: "Investors", value: investors, sub: leads.length ? `${Math.round((investors / leads.length) * 100)}% of leads` : "—", icon: Briefcase, color: "text-amber-400", bg: "bg-amber-400/10" },
    { label: "Activity Today", value: callsToday + waToday, sub: `${callsToday} calls · ${waToday} WhatsApp`, icon: PhoneCall, color: "text-blue-400", bg: "bg-blue-400/10" },
  ]

  if (error) {
    const isMissingEnv = error.toLowerCase().includes("supabase") || error.toLowerCase().includes("env")
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <Card className="max-w-xl w-full border-[#C9A84C]/20 bg-[#111111] shadow-2xl shadow-black/60">
          <CardHeader className="border-b border-[#C9A84C]/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <CardTitle className="text-red-400">{isMissingEnv ? "Setup Required" : "Connection Error"}</CardTitle>
                <p className="text-xs text-[#6B6B6B] mt-0.5">{isMissingEnv ? "Configure your environment variables to continue" : "Failed to load dashboard data"}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5 space-y-4">
            <div className="p-3 rounded-lg bg-red-950/20 border border-red-900/30 text-sm text-red-300 font-mono">
              {error}
            </div>
            {isMissingEnv && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[#C9A84C] uppercase tracking-wider">Steps to fix:</p>
                <ol className="space-y-2 text-sm text-[#E8E0D0]/80">
                  <li className="flex gap-2"><span className="text-[#C9A84C] font-bold">1.</span> Create a file named <code className="bg-[#1A1A1A] px-1.5 py-0.5 rounded text-[#C9A84C] text-xs">.env.local</code> in <code className="bg-[#1A1A1A] px-1.5 py-0.5 rounded text-[#C9A84C] text-xs">crm/</code></li>
                  <li className="flex gap-2"><span className="text-[#C9A84C] font-bold">2.</span> Add your Supabase credentials from the Supabase dashboard</li>
                  <li className="flex gap-2"><span className="text-[#C9A84C] font-bold">3.</span> Restart the dev server with <code className="bg-[#1A1A1A] px-1.5 py-0.5 rounded text-[#C9A84C] text-xs">npm run dev</code></li>
                </ol>
                <div className="rounded-lg bg-[#0A0A0A] border border-[#C9A84C]/15 p-4 font-mono text-xs text-[#C9A84C]/80 space-y-1">
                  <p className="text-[#6B6B6B]"># .env.local</p>
                  <p>NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co</p>
                  <p>NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key</p>
                  <p>SUPABASE_SERVICE_ROLE_KEY=your_service_role_key</p>
                </div>
              </div>
            )}
            <Button onClick={fetchData} variant="outline" className="w-full border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/10 bg-[#C9A84C]/5">
              <RefreshCw className="mr-2 h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F0E8]">

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[#C9A84C]/10 bg-[#0A0A0A]/90 backdrop-blur-xl">
        <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#F0C040] flex items-center justify-center shadow-lg shadow-[#C9A84C]/20">
              <Phone className="h-5 w-5 text-[#0A0A0A]" />
            </div>
            <div>
              <h1 className="text-base font-bold text-[#F5F0E8] leading-none">Call Intelligence</h1>
              <p className="text-xs text-[#6B6B6B] mt-0.5">Real Estate CRM</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={fetchData}
              disabled={loading}
              size="sm"
              variant="outline"
              className="border-[#C9A84C]/20 bg-[#C9A84C]/5 text-[#C9A84C] hover:bg-[#C9A84C]/15 hover:border-[#C9A84C]/40"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
            <Button
              onClick={handleSignOut}
              size="sm"
              variant="ghost"
              className="text-[#6B6B6B] hover:text-[#F5F0E8] hover:bg-[#1A1A1A]"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-8 space-y-6">

        <section className="relative overflow-hidden rounded-2xl border border-[#C9A84C]/20 bg-gradient-to-r from-[#17140D] via-[#111111] to-[#101418] p-6 shadow-[0_18px_55px_rgba(0,0,0,0.22)]">
          <div className="absolute -right-10 -top-14 h-40 w-40 rounded-full bg-[#C9A84C]/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#C9A84C]"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(74,222,128,0.8)]" /> Live workspace</div>
              <h2 className="text-2xl font-extrabold tracking-tight text-[#F5F0E8]">Your pipeline is ready for action.</h2>
              <p className="mt-2 max-w-xl text-sm text-[#E8E0D0]/60">{serious} serious buyer{serious === 1 ? "" : "s"} and {events.length} customer touchpoint{events.length === 1 ? "" : "s"} are being tracked in one place.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:min-w-[240px]">
              <div className="rounded-xl border border-white/5 bg-black/20 px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B]">Hot leads</p><p className="mt-1 text-xl font-extrabold text-emerald-400">{serious}</p></div>
              <div className="rounded-xl border border-white/5 bg-black/20 px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-widest text-[#6B6B6B]">Today</p><p className="mt-1 text-xl font-extrabold text-[#C9A84C]">{callsToday + waToday}</p></div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon
            return (
              <Card key={card.label} className="border-[#C9A84C]/10 bg-[#111111] hover:-translate-y-1 hover:border-[#C9A84C]/35 hover:shadow-[0_18px_35px_rgba(0,0,0,0.2)] transition-all duration-300">
                <CardContent className="p-5">
                  <div className={`w-11 h-11 rounded-xl ${card.bg} ${card.color} flex items-center justify-center mb-4`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-[10px] font-semibold text-[#6B6B6B] uppercase tracking-widest">{card.label}</p>
                  <p className="text-3xl font-extrabold text-[#F5F0E8] mt-1 mb-1">{card.value}</p>
                  <p className="text-xs text-[#E8E0D0]/50">{card.sub}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Filters */}
        <Card className="border-[#C9A84C]/10 bg-[#111111]">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative lg:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6B6B6B]" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search leads, phone, location…"
                  className="pl-9 bg-[#1A1A1A] border-[#C9A84C]/15 focus:border-[#C9A84C]/40 text-[#F5F0E8] placeholder:text-[#6B6B6B]"
                />
              </div>
              <Select value={channelFilter} onValueChange={(v) => setChannelFilter(v as typeof channelFilter)}>
                <SelectTrigger className="bg-[#1A1A1A] border-[#C9A84C]/15 text-[#F5F0E8] focus:ring-[#C9A84C]/20 focus:border-[#C9A84C]/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1A1A] border-[#C9A84C]/20 text-[#F5F0E8]">
                  <SelectItem value="all">All channels</SelectItem>
                  <SelectItem value="call">📞 Calls</SelectItem>
                  <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                </SelectContent>
              </Select>

              <Select value={intentFilter} onValueChange={(v) => setIntentFilter(v as typeof intentFilter)}>
                <SelectTrigger className="bg-[#1A1A1A] border-[#C9A84C]/15 text-[#F5F0E8] focus:ring-[#C9A84C]/20 focus:border-[#C9A84C]/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1A1A] border-[#C9A84C]/20 text-[#F5F0E8]">
                  <SelectItem value="all">All intents</SelectItem>
                  <SelectItem value="serious_buyer">🔥 Serious buyers</SelectItem>
                  <SelectItem value="investor">💼 Investors</SelectItem>
                  <SelectItem value="just_browsing">Browsing</SelectItem>
                </SelectContent>
              </Select>

              <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as typeof stageFilter)}>
                <SelectTrigger className="bg-[#1A1A1A] border-[#C9A84C]/15 text-[#F5F0E8] focus:ring-[#C9A84C]/20 focus:border-[#C9A84C]/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1A1A] border-[#C9A84C]/20 text-[#F5F0E8]">
                  <SelectItem value="all">All stages</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="site_visit">Site Visit</SelectItem>
                  <SelectItem value="negotiation">Negotiation</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Leads Table */}
        <Card className="border-[#C9A84C]/10 bg-[#111111]">
          <CardHeader className="border-b border-[#C9A84C]/10 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[#F5F0E8] text-base font-semibold">Leads</CardTitle>
              <Badge className="bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/20 hover:bg-[#C9A84C]/15">
                {filteredLeads.length} results
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-14 rounded-lg bg-[#1A1A1A] animate-pulse" />
                ))}
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="py-16 text-center">
                <div className="text-5xl mb-4 opacity-30">🏛️</div>
                <p className="text-[#F5F0E8] font-semibold text-lg mb-1">No leads found</p>
                <p className="text-[#6B6B6B] text-sm">
                  {query || channelFilter !== "all" || intentFilter !== "all" || stageFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Make a call to generate your first lead"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#C9A84C]/10 hover:bg-transparent">
                      {["Lead", "Channel", "Budget", "Location", "BHK", "Intent", "Stage", "Last Contact"].map((h) => (
                        <TableHead key={h} className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-widest whitespace-nowrap">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead) => {
                      const hasCall = events.some((e) => e.lead_phone === lead.phone && e.channel === "call")
                      const hasWA = events.some((e) => e.lead_phone === lead.phone && e.channel === "whatsapp")
                      return (
                        <TableRow
                          key={lead.id}
                          onClick={() => setSelectedLead(lead)}
                          className="cursor-pointer border-[#C9A84C]/5 hover:bg-[#C9A84C]/5 transition-colors group"
                        >
                          <TableCell className="py-4">
                            <div className="flex items-center gap-3">
                              <Avatar name={lead.name} phone={lead.phone} />
                              <div>
                                <p className="font-semibold text-[#F5F0E8] text-sm group-hover:text-[#C9A84C] transition-colors">
                                  {lead.name ?? "Unknown"}
                                </p>
                                <p className="text-xs text-[#6B6B6B]">{lead.phone}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1.5">
                              {hasCall && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  <Phone className="h-2.5 w-2.5" /> Call
                                </span>
                              )}
                              {hasWA && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <MessageSquare className="h-2.5 w-2.5" /> WA
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-[#E8E0D0] text-sm whitespace-nowrap">
                            {formatBudget(lead.budget_min, lead.budget_max)}
                          </TableCell>
                          <TableCell>
                            {lead.location ? (
                              <span className="flex items-center gap-1 text-[#E8E0D0] text-sm">
                                <MapPin className="h-3 w-3 text-[#6B6B6B]" />
                                {lead.location}
                              </span>
                            ) : <span className="text-[#6B6B6B]">—</span>}
                          </TableCell>
                          <TableCell>
                            {lead.bhk ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-[#1A1A1A] text-[#E8E0D0] border border-[#C9A84C]/10">
                                <Home className="h-3 w-3" /> {lead.bhk}
                              </span>
                            ) : <span className="text-[#6B6B6B]">—</span>}
                          </TableCell>
                          <TableCell>
                            {lead.intent === "serious_buyer" && (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15">🔥 Serious</Badge>
                            )}
                            {lead.intent === "investor" && (
                              <Badge className="bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/20 hover:bg-[#C9A84C]/15">💼 Investor</Badge>
                            )}
                            {lead.intent === "just_browsing" && (
                              <Badge variant="outline" className="border-[#3A3A3A] text-[#6B6B6B]">Browsing</Badge>
                            )}
                            {!lead.intent && <span className="text-[#6B6B6B]">—</span>}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="border-[#C9A84C]/20 text-[#E8E0D0] bg-[#C9A84C]/5 capitalize whitespace-nowrap"
                            >
                              {lead.stage.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1 text-xs text-[#6B6B6B] whitespace-nowrap">
                              <Clock className="h-3 w-3" />
                              {relativeTime(lead.last_contact_at)}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Events */}
        <Card className="border-[#C9A84C]/10 bg-[#111111]">
          <CardHeader className="border-b border-[#C9A84C]/10 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[#F5F0E8] text-base font-semibold">Recent Events</CardTitle>
              <Badge className="bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/20">{events.length} total</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {events.slice(0, 6).map((event) => {
              const inbound = event.direction === "inbound"
              const extracted = event.extracted_fields ?? {}
              const summary = safeText(extracted.summary) ?? event.transcript?.slice(0, 120) ?? null
              return (
                <div key={event.id} className="rounded-xl border border-[#C9A84C]/8 bg-[#0F0F0F] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#C9A84C]/8 bg-[#0A0A0A]">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${event.channel === "whatsapp" ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"}`}>
                        {event.channel === "whatsapp" ? <MessageSquare className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#F5F0E8]">{event.lead_phone}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${inbound ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"}`}>
                          {inbound ? "Inbound" : "Outbound"}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-[#C9A84C]">{formatDuration(event.duration_sec)}</p>
                      <p className="text-xs text-[#6B6B6B]">{relativeTime(event.created_at)}</p>
                    </div>
                  </div>
                  {summary && (
                    <div className="px-4 py-3">
                      <p className="text-xs text-[#E8E0D0]/70 leading-relaxed line-clamp-2">{summary}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      </main>

      {/* Lead Detail Modal */}
      <Dialog open={!!selectedLead} onOpenChange={() => { setSelectedLead(null); setReplyText(""); setReplySent(false) }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[#111111] border-[#C9A84C]/20 text-[#F5F0E8] p-0">
          {selectedLead && (
            <>
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-[#C9A84C]/10 bg-gradient-to-r from-[#111111] to-[#1A1A0A]">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#C9A84C] to-[#A07830] flex items-center justify-center text-[#0A0A0A] text-xl font-extrabold shadow-lg shadow-[#C9A84C]/15">
                    {(selectedLead.name ?? selectedLead.phone)[0].toUpperCase()}
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold text-[#F5F0E8]">
                      {selectedLead.name ?? "Unknown"}
                    </DialogTitle>
                    <p className="text-sm text-[#6B6B6B] mt-0.5">{selectedLead.phone}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Summary */}
                {selectedLead.summary && (
                  <div className="p-4 rounded-xl bg-[#C9A84C]/6 border border-[#C9A84C]/20 border-l-4 border-l-[#C9A84C]">
                    <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest mb-2">AI Summary</p>
                    <p className="text-sm text-[#F5F0E8] leading-relaxed">{selectedLead.summary}</p>
                  </div>
                )}

                {/* Lead Info Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Budget", value: formatBudget(selectedLead.budget_min, selectedLead.budget_max), icon: IndianRupee },
                    { label: "Location", value: selectedLead.location ?? "—", icon: MapPin },
                    { label: "BHK", value: selectedLead.bhk ?? "—", icon: Home },
                    { label: "Intent", value: selectedLead.intent?.replace("_", " ") ?? "—", icon: Target },
                    { label: "Timeline", value: selectedLead.timeline?.replace(/_/g, " ") ?? "—", icon: Calendar },
                    { label: "Stage", value: selectedLead.stage.replace("_", " "), icon: TrendingUp },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="p-3 rounded-xl bg-[#1A1A1A] border border-[#C9A84C]/8">
                      <p className="text-[10px] font-semibold text-[#6B6B6B] uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                        <Icon className="h-3 w-3" /> {label}
                      </p>
                      <p className="text-sm font-semibold text-[#F5F0E8] capitalize">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => copyPhone(selectedLead.phone)}
                    variant="outline"
                    className="flex-1 border-[#C9A84C]/20 text-[#C9A84C] hover:bg-[#C9A84C]/10 bg-[#C9A84C]/5"
                  >
                    {copiedPhone === selectedLead.phone ? (
                      <><CheckCircle2 className="mr-2 h-4 w-4" /> Copied!</>
                    ) : (
                      <><Copy className="mr-2 h-4 w-4" /> Copy Phone</>
                    )}
                  </Button>
                  <Button asChild className="flex-1 bg-gradient-to-r from-[#C9A84C] to-[#F0C040] hover:from-[#F0C040] hover:to-[#C9A84C] text-[#0A0A0A] font-semibold">
                    <a href={`tel:${selectedLead.phone}`}>
                      <Phone className="mr-2 h-4 w-4" /> Call Now
                    </a>
                  </Button>
                </div>

                {/* WhatsApp Reply */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[#6B6B6B] uppercase tracking-widest">Reply on WhatsApp</p>
                  <div className="flex gap-2 items-end">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendReply())}
                      placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                      className="bg-[#1A1A1A] border-[#C9A84C]/20 text-[#F5F0E8] placeholder:text-[#6B6B6B] focus:border-[#C9A84C]/50 min-h-[72px] resize-none"
                      disabled={replySending}
                    />
                    <Button
                      onClick={sendReply}
                      disabled={replySending || !replyText.trim()}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 self-end h-10"
                    >
                      {replySending ? <Loader2 className="h-4 w-4 animate-spin" /> : replySent ? <CheckCircle2 className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Timeline */}
                <div>
                  <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-widest mb-3">
                    Timeline ({selectedEvents.length})
                  </p>
                  <div className="space-y-3">
                    {selectedEvents.length === 0 ? (
                      <p className="text-[#6B6B6B] text-center py-8">No events yet</p>
                    ) : (
                      selectedEvents.map((event) => {
                        const inbound = event.direction === "inbound"
                        const extracted = event.extracted_fields ?? {}
                        const summary = safeText(extracted.summary) ?? event.transcript ?? null
                        return (
                          <div key={event.id} className="rounded-xl border border-[#C9A84C]/8 bg-[#0F0F0F] overflow-hidden">
                            <div className="flex items-center justify-between px-4 py-3 border-b border-[#C9A84C]/8 bg-[#0A0A0A]">
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${event.channel === "whatsapp" ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"}`}>
                                  {event.channel === "whatsapp" ? <MessageSquare className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-[#F5F0E8] capitalize">
                                    {event.channel} · {event.direction}
                                  </p>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${inbound ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"}`}>
                                    {inbound ? "Inbound" : "Outbound"}
                                  </span>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-[#C9A84C]">{formatDuration(event.duration_sec)}</p>
                                <p className="text-xs text-[#6B6B6B]">{relativeTime(event.created_at)}</p>
                              </div>
                            </div>

                            <div className="p-4 space-y-3">
                              <div className="grid grid-cols-3 gap-2">
                                {[
                                  ["Name", safeText(extracted.name)],
                                  ["Budget", safeText(extracted.budget_min_lakhs) ? `₹${safeText(extracted.budget_min_lakhs)}–${safeText(extracted.budget_max_lakhs) ?? ""}L` : null],
                                  ["Location", safeText(extracted.location)],
                                ].map(([label, value]) => (
                                  <div key={label} className="bg-[#1A1A1A] rounded-lg p-2.5 border border-[#C9A84C]/8">
                                    <p className="text-[10px] text-[#6B6B6B] uppercase tracking-wider mb-1">{label}</p>
                                    <p className="text-xs font-semibold text-[#F5F0E8]">{value ?? "—"}</p>
                                  </div>
                                ))}
                              </div>

                              {summary && (
                                <div className="p-3 rounded-lg bg-[#C9A84C]/4 border border-[#C9A84C]/15 border-l-2 border-l-[#C9A84C]/60">
                                  <p className="text-xs text-[#E8E0D0] leading-relaxed">{summary}</p>
                                </div>
                              )}

                              {event.transcript && (
                                <details className="group">
                                  <summary className="cursor-pointer text-xs text-[#C9A84C] font-semibold flex items-center gap-1.5 hover:text-[#F0C040] transition-colors select-none">
                                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
                                    View full transcript
                                  </summary>
                                  <div className="mt-2 p-3 rounded-lg bg-[#050505] border border-[#C9A84C]/10 text-xs text-[#C9A84C]/80 font-mono whitespace-pre-wrap leading-relaxed">
                                    {event.transcript}
                                  </div>
                                </details>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

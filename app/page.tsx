import Link from "next/link"
import { ArrowRight, Bot, CheckCircle2, Phone, Sparkles, Target } from "lucide-react"

const features = [
  { icon: Phone, title: "Capture every conversation", text: "Calls and WhatsApp messages become organised customer records automatically." },
  { icon: Bot, title: "AI finds the signal", text: "Extract budget, location, intent, timeline, and the best next action." },
  { icon: Target, title: "Follow up with confidence", text: "See who is ready now and where your team should focus next." },
]

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#070809] text-[#F7F5EF]">
      <div className="aurora aurora-one" />
      <div className="aurora aurora-two" />
      <div className="grid-overlay" />

      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="CallCRM home">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#F5D675] via-[#C9A84C] to-[#936F25] shadow-[0_10px_30px_rgba(201,168,76,0.25)]"><Phone className="h-5 w-5 text-[#15110a]" /></span>
          <span><span className="block text-base font-bold tracking-tight">CallCRM</span><span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C9A84C]">AI lead intelligence</span></span>
        </Link>
        <div className="flex items-center gap-3"><Link href="#how-it-works" className="hidden text-sm text-[#C9C6BA] transition hover:text-white sm:block">How it works</Link><Link href="/login" className="rounded-xl border border-[#C9A84C]/30 bg-[#C9A84C]/10 px-4 py-2 text-sm font-semibold text-[#F5D675] transition hover:border-[#C9A84C]/60 hover:bg-[#C9A84C]/20">Sign in</Link></div>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-6 pb-24 pt-14 lg:grid-cols-[1.04fr_.96fr] lg:px-8 lg:pb-32 lg:pt-24">
        <div className="animate-rise">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#C9A84C]/25 bg-[#C9A84C]/10 px-3 py-1.5 text-xs font-semibold text-[#F5D675]"><Sparkles className="h-3.5 w-3.5" /> Built for modern real-estate teams</div>
          <h1 className="max-w-3xl text-5xl font-black leading-[1.03] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">Turn every conversation into your next <span className="text-gradient-gold">closed deal.</span></h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-[#B7B4A9] sm:text-lg">CallCRM listens to calls, understands buyer intent, and gives your team one beautiful workspace to act on every lead.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row"><Link href="/login" className="group inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#F0CE67] via-[#C9A84C] to-[#B08A38] px-5 text-sm font-extrabold text-[#171207] shadow-[0_12px_32px_rgba(201,168,76,0.25)] transition hover:-translate-y-0.5">Open your workspace <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link><a href="#how-it-works" className="inline-flex h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-5 text-sm font-semibold text-[#E9E5D9] transition hover:bg-white/[0.07]">See how it works</a></div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs font-medium text-[#A9A69C]"><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Call transcription</span><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> AI lead scoring</span><span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Smart follow-ups</span></div>
        </div>

        <div className="relative mx-auto w-full max-w-[570px] animate-float-in"><div className="absolute -inset-8 rounded-full bg-[#C9A84C]/10 blur-3xl" /><div className="relative rounded-[28px] border border-white/[0.12] bg-[#101112]/90 p-3 shadow-[0_35px_100px_rgba(0,0,0,0.52)] backdrop-blur-xl"><div className="overflow-hidden rounded-[19px] border border-white/[0.06] bg-[#0A0B0C]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4"><div className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.9)]" /><span className="text-sm font-bold">Today&apos;s lead pulse</span></div><span className="rounded-full bg-[#C9A84C]/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#ECCE70]">Live</span></div>
          <div className="grid grid-cols-3 gap-2 p-4">{[["24", "New leads"], ["08", "Hot now"], ["05", "Follow-ups"]].map(([value, label]) => <div key={label} className="rounded-xl border border-white/[0.06] bg-white/[0.035] p-3"><p className="text-xl font-extrabold text-white">{value}</p><p className="mt-1 text-[10px] font-medium text-[#858277]">{label}</p></div>)}</div>
          <div className="mx-4 mb-4 rounded-2xl border border-[#C9A84C]/20 bg-gradient-to-r from-[#C9A84C]/15 to-[#C9A84C]/[0.04] p-4"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C9A84C]/20 text-[#F0D26F]"><Sparkles className="h-5 w-5" /></span><div><p className="text-xs font-bold text-[#F6E6AB]">AI priority insight</p><p className="mt-1 text-xs leading-5 text-[#D5D0C1]">Priya is ready for a 3BHK site visit in Andheri this weekend.</p></div></div></div>
          <div className="space-y-2 px-4 pb-4">{[["Priya Shah", "3BHK · Andheri West", "Hot lead", "bg-rose-400"], ["Rahul Mehta", "2BHK · Powai", "Call back", "bg-amber-300"], ["Ayesha Khan", "Investment · Bandra", "New inquiry", "bg-emerald-400"]].map(([name, detail, status, colour]) => <div key={name} className="flex items-center gap-3 rounded-xl border border-white/[0.055] bg-white/[0.025] px-3 py-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#D9BD65] to-[#8E6C28] text-xs font-black text-[#151109]">{name[0]}</span><div className="min-w-0 flex-1"><p className="text-xs font-bold text-[#F0EEE7]">{name}</p><p className="mt-0.5 truncate text-[10px] text-[#88857C]">{detail}</p></div><span className="flex items-center gap-1.5 text-[10px] font-semibold text-[#C3C0B7]"><span className={`h-1.5 w-1.5 rounded-full ${colour}`} />{status}</span></div>)}</div>
        </div></div></div>
      </section>

      <section className="relative z-10 border-y border-white/[0.07] bg-white/[0.018]" id="how-it-works"><div className="mx-auto max-w-7xl px-6 py-20 lg:px-8"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9A84C]">Designed for momentum</p><h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">More than a dashboard. Your team&apos;s daily command centre.</h2></div><div className="mt-10 grid gap-4 md:grid-cols-3">{features.map(({ icon: Icon, title, text }, index) => <article key={title} className="hover-lift group rounded-2xl border border-white/[0.08] bg-[#111213]/70 p-6"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#C9A84C]/10 text-[#E8C760] transition group-hover:scale-110 group-hover:bg-[#C9A84C]/20"><Icon className="h-5 w-5" /></span><p className="mt-6 text-sm font-bold text-white">0{index + 1} · {title}</p><p className="mt-3 text-sm leading-6 text-[#A9A69D]">{text}</p></article>)}</div></div></section>
      <section className="relative z-10 mx-auto max-w-7xl px-6 py-24 lg:px-8"><div className="rounded-3xl border border-[#C9A84C]/20 bg-gradient-to-br from-[#18150d] via-[#101112] to-[#101112] p-7 shadow-[0_20px_70px_rgba(0,0,0,0.28)] lg:p-10"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9A84C]">From conversation to conversion</p><h2 className="mt-3 max-w-xl text-3xl font-black tracking-tight text-white">A simple workflow that keeps every lead moving.</h2><div className="mt-10 grid gap-6 lg:grid-cols-3">{[["01", "A prospect calls or messages", "Your normal activity flows in automatically."], ["02", "CallCRM understands the conversation", "AI transcribes, summarises, and organises information in seconds."], ["03", "Your team takes the right next step", "Prioritise serious buyers, reply faster, and move deals ahead."]].map(([number, title, text]) => <div key={number} className="border-l border-[#C9A84C]/30 pl-5 lg:border-l-0 lg:border-t lg:pt-5 lg:pl-0"><p className="text-xs font-black tracking-widest text-[#D8B751]">{number}</p><p className="mt-3 text-sm font-bold text-white">{title}</p><p className="mt-2 text-sm leading-6 text-[#9D9A90]">{text}</p></div>)}</div></div></section>
      <footer className="relative z-10 border-t border-white/[0.07] px-6 py-7 text-center text-xs text-[#77746B]">CallCRM · AI lead intelligence for real-estate teams</footer>
    </main>
  )
}
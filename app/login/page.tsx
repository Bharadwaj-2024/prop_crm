"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Phone, Loader2, AlertCircle } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Login failed")
        return
      }

      sessionStorage.setItem("access_token", data.accessToken)
      sessionStorage.setItem("broker", JSON.stringify(data.broker))
      document.cookie = `session_token=${data.accessToken}; path=/; max-age=900; SameSite=Lax`

      router.push("/dashboard")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#0A0A0A]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/20 via-transparent to-transparent" />

      <Card className="w-full max-w-md relative border-amber-900/30 bg-[#111111]/80 backdrop-blur-xl shadow-2xl shadow-black/50">
        <CardHeader className="space-y-6 text-center pb-8">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-[#C9A84C] to-[#F0C040] flex items-center justify-center shadow-lg shadow-amber-500/25">
            <Phone className="h-8 w-8 text-[#0A0A0A]" />
          </div>

          <div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-[#C9A84C] to-[#F0C040] bg-clip-text text-transparent">
              CallCRM
            </CardTitle>
            <CardDescription className="text-[#6B6B6B] mt-2">
              Real Estate Intelligence Platform
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-[#C9A84C]/90 uppercase tracking-wider">
                Email
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                required
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@agency.com"
                className="bg-[#1A1A1A] border-[#C9A84C]/20 focus:border-[#C9A84C]/50 focus:ring-[#C9A84C]/20 text-[#F5F0E8] placeholder:text-[#6B6B6B]"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-[#C9A84C]/90 uppercase tracking-wider">
                Password
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                required
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-[#1A1A1A] border-[#C9A84C]/20 focus:border-[#C9A84C]/50 focus:ring-[#C9A84C]/20 text-[#F5F0E8] placeholder:text-[#6B6B6B]"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/30 border border-red-900/50 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-gradient-to-r from-[#C9A84C] to-[#F0C040] hover:from-[#F0C040] hover:to-[#C9A84C] text-[#0A0A0A] font-semibold shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-200"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-[#3A3A3A] tracking-wide">
            Secured with JWT Authentication
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

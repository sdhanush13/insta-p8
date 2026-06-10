"use client"

import { useEffect, useState } from "react"
import { useInstagramSession } from "@/hooks/use-instagram-session"
import { Card } from "@/components/ui/card"
import { CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw, Webhook, KeyRound, Radio } from "lucide-react"

interface Health {
    username: string
    token: { expiresAt: string | null; daysLeft: number | null; expired: boolean; valid: boolean }
    subscription: { ok: boolean; fields: string[] }
    lastEventAt: string | null
}

function relative(ts: string | null) {
    if (!ts) return "never"
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins} min ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs} hr ago`
    return `${Math.floor(hrs / 24)} d ago`
}

export default function SettingsPage() {
    const { userId, isLoading: sessionLoading } = useInstagramSession()
    const [health, setHealth] = useState<Health | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const load = async () => {
        if (!userId) return
        setLoading(true)
        setError(null)
        try {
            const res = await fetch(`/api/instagram/health?userId=${userId}`)
            const data = await res.json()
            if (data.error) setError(data.error)
            else setHealth(data)
        } catch {
            setError("Failed to load health")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (userId) load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId])

    if (sessionLoading || loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
        )
    }

    const tokenWarn = health && !health.token.expired && (health.token.daysLeft ?? 99) <= 7

    return (
        <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6 animate-in fade-in duration-700">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-white">Settings</h1>
                    <p className="text-muted-foreground text-sm">Connection health for @{health?.username}</p>
                </div>
                <button
                    onClick={load}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-neutral-300 hover:bg-white/10 transition-all"
                >
                    <RefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            {error ? (
                <Card className="p-6 bg-white/5 border-white/10 text-red-400 text-sm">{error}</Card>
            ) : !health ? null : (
                <div className="space-y-4">
                    {/* Token */}
                    <HealthRow
                        icon={<KeyRound className="w-5 h-5" />}
                        title="Access Token"
                        ok={health.token.valid && !health.token.expired && !tokenWarn}
                        warn={!!tokenWarn}
                        bad={health.token.expired || !health.token.valid}
                        detail={
                            health.token.expired
                                ? "Expired — reconnect Instagram to restore automations."
                                : !health.token.valid
                                    ? "Token rejected by Instagram — reconnect to fix."
                                    : health.token.daysLeft !== null
                                        ? `Valid · expires in ${health.token.daysLeft} day${health.token.daysLeft === 1 ? "" : "s"}`
                                        : "Valid"
                        }
                    />

                    {/* Webhook subscription */}
                    <HealthRow
                        icon={<Webhook className="w-5 h-5" />}
                        title="Webhook Subscription"
                        ok={health.subscription.ok}
                        bad={!health.subscription.ok}
                        detail={
                            health.subscription.ok
                                ? `Subscribed: ${health.subscription.fields.join(", ")}`
                                : "Not subscribed — reconnect Instagram to re-subscribe to comments & messages."
                        }
                    />

                    {/* Last event */}
                    <HealthRow
                        icon={<Radio className="w-5 h-5" />}
                        title="Last Webhook Event"
                        ok={!!health.lastEventAt}
                        warn={!health.lastEventAt}
                        detail={
                            health.lastEventAt
                                ? `Received ${relative(health.lastEventAt)}`
                                : "No events received yet — comment/DM from a test account to verify."
                        }
                    />

                    {(health.token.expired || !health.token.valid || !health.subscription.ok) && (
                        <Card className="p-4 bg-amber-500/10 border-amber-500/20 text-amber-300 text-sm flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                            <span>Something needs attention. Reconnecting your Instagram account fixes token and subscription issues in one step.</span>
                        </Card>
                    )}
                </div>
            )}
        </div>
    )
}

function HealthRow({ icon, title, detail, ok, warn, bad }: {
    icon: React.ReactNode
    title: string
    detail: string
    ok?: boolean
    warn?: boolean
    bad?: boolean
}) {
    const status = bad
        ? { color: "text-red-400", bg: "bg-red-500/10 ring-red-500/20", Icon: XCircle }
        : warn
            ? { color: "text-amber-400", bg: "bg-amber-500/10 ring-amber-500/20", Icon: AlertTriangle }
            : { color: "text-emerald-400", bg: "bg-emerald-500/10 ring-emerald-500/20", Icon: CheckCircle2 }
    const { Icon } = status

    return (
        <Card className="p-5 bg-white/5 border-white/10 flex items-center gap-4">
            <span className={`p-2.5 rounded-xl ring-1 ${status.bg} ${status.color}`}>{icon}</span>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="text-xs text-muted-foreground break-words">{detail}</p>
            </div>
            <Icon className={`w-5 h-5 shrink-0 ${status.color}`} />
        </Card>
    )
}

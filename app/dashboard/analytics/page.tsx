"use client"

import { useEffect, useState } from "react"
import { useInstagramSession } from "@/hooks/use-instagram-session"
import { Card } from "@/components/ui/card"
import { Users, UserPlus, Grid3x3, Eye, Heart, MessageCircle, TrendingUp, Loader2, ExternalLink } from "lucide-react"

interface Analytics {
    username: string
    profile: { followers: number; following: number; posts: number }
    reach: number | null
    totals: { likes: number; comments: number; posts: number; avgEngagement: number }
    topPosts: Array<{
        id: string
        caption: string
        thumbnail?: string
        permalink: string
        timestamp: string
        likes: number
        comments: number
        engagement: number
    }>
}

const fmt = (n: number) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : n.toString())

export default function AnalyticsPage() {
    const { userId, isLoading: isSessionLoading } = useInstagramSession()
    const [data, setData] = useState<Analytics | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!userId) return
        setLoading(true)
        fetch(`/api/instagram/analytics?userId=${userId}`)
            .then((res) => res.json())
            .then((d) => {
                if (d.error) setError(d.error)
                else setData(d)
            })
            .catch(() => setError("Failed to load analytics"))
            .finally(() => setLoading(false))
    }, [userId])

    if (isSessionLoading || loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
                <p className="text-red-400 mb-2">{error}</p>
                <p className="text-muted-foreground text-sm">Make sure your account is connected with insights permissions.</p>
            </div>
        )
    }

    if (!data) return null

    const maxEngagement = Math.max(1, ...data.topPosts.map((p) => p.engagement))

    const stats = [
        { label: "Followers", value: fmt(data.profile.followers), icon: <Users className="w-5 h-5 text-pink-400" /> },
        { label: "Following", value: fmt(data.profile.following), icon: <UserPlus className="w-5 h-5 text-blue-400" /> },
        { label: "Posts", value: fmt(data.profile.posts), icon: <Grid3x3 className="w-5 h-5 text-purple-400" /> },
        ...(data.reach !== null
            ? [{ label: "Reach (28d)", value: fmt(data.reach), icon: <Eye className="w-5 h-5 text-emerald-400" /> }]
            : []),
        { label: "Likes (recent)", value: fmt(data.totals.likes), icon: <Heart className="w-5 h-5 text-red-400" /> },
        { label: "Comments (recent)", value: fmt(data.totals.comments), icon: <MessageCircle className="w-5 h-5 text-sky-400" /> },
        { label: "Avg / Post", value: fmt(data.totals.avgEngagement), icon: <TrendingUp className="w-5 h-5 text-amber-400" /> },
    ]

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-700">
            <div>
                <h1 className="text-3xl font-bold text-white">Analytics</h1>
                <p className="text-muted-foreground">@{data.username} · engagement across your {data.totals.posts} most recent posts</p>
            </div>

            {/* Stat grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {stats.map((s) => (
                    <Card key={s.label} className="p-5 bg-black/40 border-white/10 backdrop-blur-md hover:bg-white/5 transition-colors">
                        <span className="p-2 bg-white/5 rounded-lg ring-1 ring-white/10 inline-flex">{s.icon}</span>
                        <p className="text-2xl font-bold text-white tracking-tight mt-3">{s.value}</p>
                        <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">{s.label}</p>
                    </Card>
                ))}
            </div>

            {/* Top posts */}
            <Card className="p-6 bg-white/5 border-white/10 backdrop-blur-sm">
                <h3 className="font-bold text-white mb-4">Top Posts by Engagement</h3>
                {data.topPosts.length === 0 ? (
                    <p className="py-8 text-center text-muted-foreground text-sm">No posts found.</p>
                ) : (
                    <div className="space-y-3">
                        {data.topPosts.map((p) => (
                            <a
                                key={p.id}
                                href={p.permalink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors group"
                            >
                                {p.thumbnail ? (
                                    <img src={p.thumbnail} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                                ) : (
                                    <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                        <Grid3x3 className="w-5 h-5 text-neutral-600" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white truncate">{p.caption || "Untitled"}</p>
                                    <div className="mt-1.5 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-pink-500 to-purple-500"
                                            style={{ width: `${(p.engagement / maxEngagement) * 100}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                                    <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-red-400" />{fmt(p.likes)}</span>
                                    <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5 text-sky-400" />{fmt(p.comments)}</span>
                                    <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </Card>

            {data.reach === null && (
                <p className="text-[11px] text-neutral-600 text-center">
                    Account reach is unavailable for this account/token. Profile and post engagement are shown above.
                </p>
            )}
        </div>
    )
}

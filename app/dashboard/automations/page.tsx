"use client"

import { useState, useCallback, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { useInstagramSession } from "@/hooks/use-instagram-session"
import { AutomationList } from "@/components/dashboard/AutomationList"
import { CreateRuleForm } from "@/components/dashboard/CreateRuleForm"
import { MessageCircle, Send, Sparkles, Zap, Plus, Brain, Loader2, History } from "lucide-react"
import { IceBreakersManager } from "@/components/dashboard/IceBreakersManager"
import type { Automation } from "@/lib/types"

export default function AutomationsPage() {
    const { userId, isLoading: isSessionLoading } = useInstagramSession()
    const searchParams = useSearchParams()
    const [automations, setAutomations] = useState<Automation[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'comment' | 'dm' | 'story'>('comment')
    const [showCreateForm, setShowCreateForm] = useState(false)
    const [aiEnabled, setAiEnabled] = useState(false)
    const [aiLoading, setAiLoading] = useState(true)
    const [aiToggling, setAiToggling] = useState(false)
    const [showAiContext, setShowAiContext] = useState(false)
    const [aiContext, setAiContext] = useState("")
    const [aiContextSaving, setAiContextSaving] = useState(false)
    const [aiContextSaved, setAiContextSaved] = useState(false)

    useEffect(() => {
        if (!userId) return
        fetch(`/api/groq/auto-reply?userId=${userId}`)
            .then(res => res.json())
            .then(data => {
                setAiEnabled(data.enabled ?? false)
                setAiContext(data.ai_context ?? "")
            })
            .catch(() => {})
            .finally(() => setAiLoading(false))
    }, [userId])

    const handleSaveAiContext = async () => {
        if (aiContextSaving) return
        setAiContextSaving(true)
        try {
            await fetch("/api/groq/auto-reply", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, enabled: aiEnabled, ai_context: aiContext }),
            })
            setAiContextSaved(true)
            setTimeout(() => setAiContextSaved(false), 2000)
        } catch {}
        setAiContextSaving(false)
    }

    const handleToggleAI = async () => {
        if (aiToggling) return
        setAiToggling(true)
        const newState = !aiEnabled
        try {
            const res = await fetch("/api/groq/auto-reply", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, enabled: newState }),
            })
            if (res.ok) setAiEnabled(newState)
        } catch {}
        setAiToggling(false)
    }

    const fetchAutomations = useCallback(async () => {
        if (!userId) return
        try {
            const res = await fetch(`/api/automations?userId=${userId}`)
            const data = await res.json()
            if (res.ok) setAutomations(Array.isArray(data) ? data : [])
        } catch (err) {
            console.error("Fetch error:", err)
        } finally {
            setIsLoading(false)
        }
    }, [userId])

    useEffect(() => {
        if (userId) fetchAutomations()
    }, [userId, fetchAutomations])

    // Auto-open the create form when arriving from the dashboard "New Rule" action
    useEffect(() => {
        if (searchParams.get("new") === "1") setShowCreateForm(true)
    }, [searchParams])

    const handleDeleteRule = async (id: string) => {
        await fetch(`/api/automations?id=${id}`, { method: "DELETE" })
        fetchAutomations()
    }

    // Backfill: run comment automations on past unanswered comments
    const [scanDays, setScanDays] = useState(7)
    const [scanning, setScanning] = useState(false)
    const [scanResult, setScanResult] = useState<any | null>(null)

    const handleScan = async () => {
        if (scanning) return
        setScanning(true)
        setScanResult(null)
        try {
            const res = await fetch("/api/automations/scan-comments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, days: scanDays }),
            })
            const data = await res.json()
            setScanResult(data)
        } catch {
            setScanResult({ error: "Network error" })
        } finally {
            setScanning(false)
        }
    }

    if (isSessionLoading) return <div className="h-screen flex items-center justify-center bg-black"><div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" /></div>
    if (!userId) return <div className="h-screen flex items-center justify-center bg-black text-neutral-500">Please log in</div>

    const filteredAutomations = automations.filter(a => a.trigger_source === activeTab)
    const counts = {
        comment: automations.filter(a => a.trigger_source === 'comment').length,
        dm: automations.filter(a => a.trigger_source === 'dm').length,
        story: automations.filter(a => a.trigger_source === 'story').length,
    }

    const tabs = [
        { key: 'comment' as const, icon: <MessageCircle className="w-4 h-4" />, label: 'Comments', count: counts.comment },
        { key: 'dm' as const, icon: <Send className="w-4 h-4" />, label: 'DMs', count: counts.dm },
        { key: 'story' as const, icon: <Sparkles className="w-4 h-4" />, label: 'Stories', count: counts.story },
    ]

    return (
        <div className="min-h-screen bg-black p-4 md:p-8">
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                            <Zap className="w-5 h-5 text-yellow-400" />
                            Automations
                        </h1>
                        <p className="text-neutral-500 text-sm mt-0.5">
                            {automations.length} active rule{automations.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* AI Auto-Reply Toggle */}
                        {aiLoading ? (
                            <Loader2 className="w-4 h-4 text-neutral-500 animate-spin" />
                        ) : (
                            <>
                                <button
                                    onClick={() => setShowAiContext(!showAiContext)}
                                    className="p-2 rounded-xl bg-white/5 border border-white/10 text-neutral-500 hover:text-white hover:bg-white/10 transition-all"
                                    title="AI Settings"
                                >
                                    <Brain className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={handleToggleAI}
                                    disabled={aiToggling}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold tracking-wide uppercase transition-all ${
                                        aiEnabled
                                            ? 'bg-purple-500/10 border border-purple-500/30 text-purple-400 hover:bg-purple-500/20'
                                            : 'bg-white/5 border border-white/10 text-neutral-500 hover:bg-white/10'
                                    }`}
                                >
                                    <Sparkles className={`w-3.5 h-3.5 ${aiToggling ? 'animate-pulse' : ''}`} />
                                    {aiToggling ? '...' : aiEnabled ? 'AI ON' : 'AI OFF'}
                                </button>
                            </>
                        )}
                        <button
                            onClick={() => setShowCreateForm(!showCreateForm)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                                showCreateForm 
                                    ? 'bg-white/10 text-white border border-white/20' 
                                    : 'bg-white text-black hover:bg-white/90 shadow-lg shadow-white/5'
                            }`}
                        >
                            <Plus className={`w-4 h-4 transition-transform duration-200 ${showCreateForm ? 'rotate-45' : ''}`} />
                            {showCreateForm ? 'Close' : 'New Rule'}
                        </button>
                    </div>
                </div>

                {/* AI Context Panel */}
                {showAiContext && (
                    <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-5 animate-in fade-in slide-in-from-top-2 duration-200 space-y-3">
                        <div className="flex items-center gap-2">
                            <Brain className="w-4 h-4 text-purple-400" />
                            <span className="text-sm font-semibold text-purple-300">AI Personality Context</span>
                        </div>
                        <p className="text-xs text-neutral-500">Tell AI about your account — niche, products, tone, what to say/avoid. More context = more human replies.</p>
                        <textarea
                            value={aiContext}
                            onChange={e => setAiContext(e.target.value)}
                            placeholder={`e.g. This is a fitness coaching account. I sell online training programs (₹2999/mo). My tone is motivating but chill. If someone asks about pricing, tell them to DM for a free consultation. Never promise specific results.`}
                            rows={4}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 resize-none focus:outline-none focus:border-purple-500/50 transition-colors"
                        />
                        <button
                            onClick={handleSaveAiContext}
                            disabled={aiContextSaving}
                            className="px-4 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white text-xs font-bold transition-all disabled:opacity-50"
                        >
                            {aiContextSaving ? 'Saving...' : aiContextSaved ? 'Saved ✓' : 'Save Context'}
                        </button>
                    </div>
                )}

                {/* Pill Tabs */}
                <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                                activeTab === tab.key
                                    ? 'bg-white text-black shadow-sm'
                                    : 'text-neutral-500 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {tab.icon}
                            <span className="hidden sm:inline">{tab.label}</span>
                            {tab.count > 0 && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                    activeTab === tab.key ? 'bg-black/10 text-black' : 'bg-white/10 text-white'
                                }`}>
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Create Form (Collapsible) */}
                {showCreateForm && (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 animate-in fade-in slide-in-from-top-2 duration-300">
                        <CreateRuleForm
                            userId={userId}
                            triggerSource={activeTab}
                            onSuccess={() => {
                                fetchAutomations()
                                setShowCreateForm(false)
                            }}
                        />
                    </div>
                )}

                {/* Backfill past comments (Comments only) */}
                {activeTab === 'comment' && (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
                        <div className="flex items-center gap-2">
                            <History className="w-4 h-4 text-sky-400" />
                            <span className="text-sm font-semibold text-sky-300">Run on past comments</span>
                        </div>
                        <p className="text-xs text-neutral-500">
                            Scan recent comments and run your active comment rules on any you haven&apos;t replied to yet.
                            Instagram only allows replying within <span className="text-neutral-300">7 days</span>, so that&apos;s the max.
                        </p>
                        <div className="flex items-center gap-3 flex-wrap">
                            <label className="text-xs text-neutral-400 flex items-center gap-2">
                                Last
                                <input
                                    type="number"
                                    min={1}
                                    max={7}
                                    value={scanDays}
                                    onChange={(e) => setScanDays(Math.min(7, Math.max(1, Number(e.target.value) || 1)))}
                                    className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-sky-500/50"
                                />
                                day{scanDays !== 1 ? 's' : ''}
                            </label>
                            <button
                                onClick={handleScan}
                                disabled={scanning}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition-all disabled:opacity-50"
                            >
                                {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <History className="w-3.5 h-3.5" />}
                                {scanning ? 'Scanning…' : 'Scan & Reply'}
                            </button>
                        </div>

                        {scanResult && (
                            <div className="text-xs rounded-xl border border-white/10 bg-black/30 p-3 mt-1">
                                {scanResult.error ? (
                                    <span className="text-red-400">{scanResult.error}</span>
                                ) : (
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-neutral-300">
                                        <span>✅ Replied: <span className="font-bold text-emerald-400">{scanResult.replied}</span></span>
                                        <span>🎯 Matched: <span className="font-bold text-white">{scanResult.matched}</span></span>
                                        <span>🔍 Scanned: <span className="font-bold text-white">{scanResult.scanned}</span></span>
                                        <span>⏭️ Skipped: <span className="text-neutral-400">{scanResult.skipped}</span></span>
                                        {scanResult.errors > 0 && <span>⚠️ Errors: <span className="text-amber-400">{scanResult.errors}</span></span>}
                                        {scanResult.cappedAt > 0 && (
                                            <span className="w-full text-amber-400">Stopped at the {scanResult.cappedAt}-reply safety cap — run again to continue.</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Ice Breakers (DM only) */}
                {activeTab === 'dm' && (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
                        <IceBreakersManager />
                    </div>
                )}

                {/* Automation List */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    </div>
                ) : (
                    <AutomationList
                        automations={filteredAutomations}
                        onDelete={handleDeleteRule}
                        userId={userId}
                    />
                )}
            </div>
        </div>
    )
}

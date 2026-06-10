import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"

// AI auto-reply settings, backed by the users table
// (groq_auto_reply_enabled — migration 08, ai_context — migration 09).

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })

    const supabase = await getSupabaseServerClient()
    const { data, error } = await supabase
      .from("users")
      .select("groq_auto_reply_enabled, ai_context")
      .eq("id", userId)
      .single()

    if (error) throw error
    return NextResponse.json({
      enabled: data?.groq_auto_reply_enabled ?? false,
      ai_context: data?.ai_context ?? "",
    })
  } catch (error) {
    console.error("Groq settings GET error:", error)
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId, enabled, ai_context } = await request.json()
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })

    const updates: Record<string, unknown> = {}
    if (typeof enabled === "boolean") updates.groq_auto_reply_enabled = enabled
    if (typeof ai_context === "string") updates.ai_context = ai_context

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
    }

    const supabase = await getSupabaseServerClient()
    const { error } = await supabase.from("users").update(updates).eq("id", userId)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Groq settings PUT error:", error)
    // Surface the real cause (e.g. missing column) instead of a generic message.
    return NextResponse.json(
      { error: "Failed to save settings", detail: error?.message, code: error?.code },
      { status: 500 },
    )
  }
}

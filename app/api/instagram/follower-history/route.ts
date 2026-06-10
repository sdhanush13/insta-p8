import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"

// Daily follower-count snapshots (populated by the daily cron) for growth charts.
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })

    const supabase = await getSupabaseServerClient()
    const { data, error } = await supabase
      .from("follower_snapshots")
      .select("captured_on, followers_count")
      .eq("user_id", userId)
      .order("captured_on", { ascending: true })
      .limit(90)

    if (error) throw error
    return NextResponse.json(data || [])
  } catch (error) {
    console.error("[v0] Follower history error:", error)
    return NextResponse.json({ error: "Failed to load history" }, { status: 500 })
  }
}

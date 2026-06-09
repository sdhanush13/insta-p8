/* @ts-nocheck */

// Instagram analytics: profile counts + per-post engagement from /me/media
// (reliable), plus a best-effort account reach pull (the insights endpoint is
// version-sensitive, so it degrades gracefully to null on any error).

import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"

const GRAPH = "https://graph.instagram.com/v24.0"

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })

    const supabase = await getSupabaseServerClient()
    const { data: user } = await supabase
      .from("users")
      .select("access_token, username")
      .eq("id", userId)
      .single()

    if (!user?.access_token) return NextResponse.json({ error: "Instagram not connected" }, { status: 401 })
    const token = user.access_token

    // 1. Profile counts
    const profileRes = await fetch(
      `${GRAPH}/me?fields=username,followers_count,follows_count,media_count&access_token=${token}`,
      { cache: "no-store" },
    )
    const profile = await profileRes.json()
    if (profile.error) {
      const code = profile.error.code
      const status = code === 190 ? 401 : 500
      return NextResponse.json(
        { error: code === 190 ? "Session expired. Please log out and reconnect." : profile.error.message },
        { status },
      )
    }

    // 2. Recent posts with engagement
    const mediaRes = await fetch(
      `${GRAPH}/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=24&access_token=${token}`,
      { cache: "no-store" },
    )
    const mediaData = await mediaRes.json()
    const posts = (mediaData.data || []).map((m: any) => ({
      id: m.id,
      caption: m.caption || "",
      media_type: m.media_type,
      thumbnail: m.media_type === "VIDEO" ? m.thumbnail_url : m.media_url,
      permalink: m.permalink,
      timestamp: m.timestamp,
      likes: m.like_count || 0,
      comments: m.comments_count || 0,
      engagement: (m.like_count || 0) + (m.comments_count || 0),
    }))

    const totals = posts.reduce(
      (acc: any, p: any) => {
        acc.likes += p.likes
        acc.comments += p.comments
        return acc
      },
      { likes: 0, comments: 0 },
    )
    const postCount = posts.length
    const avgEngagement = postCount ? Math.round((totals.likes + totals.comments) / postCount) : 0
    const topPosts = [...posts].sort((a, b) => b.engagement - a.engagement).slice(0, 5)

    // 3. Best-effort account reach (last 28 days) — null if the endpoint errors
    let reach: number | null = null
    try {
      const insightsRes = await fetch(
        `${GRAPH}/me/insights?metric=reach&period=days_28&metric_type=total_value&access_token=${token}`,
        { cache: "no-store" },
      )
      const insights = await insightsRes.json()
      if (!insights.error && Array.isArray(insights.data)) {
        const reachMetric = insights.data.find((d: any) => d.name === "reach")
        reach =
          reachMetric?.total_value?.value ??
          reachMetric?.values?.[reachMetric.values.length - 1]?.value ??
          null
      }
    } catch {
      reach = null
    }

    return NextResponse.json({
      username: profile.username,
      profile: {
        followers: profile.followers_count ?? 0,
        following: profile.follows_count ?? 0,
        posts: profile.media_count ?? 0,
      },
      reach,
      totals: { likes: totals.likes, comments: totals.comments, posts: postCount, avgEngagement },
      topPosts,
      recentPosts: posts,
    })
  } catch (error: any) {
    console.error("[v0] Analytics error:", error)
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"

// Daily scheduled job (Vercel Cron → see vercel.json).
// 1. Refreshes long-lived Instagram tokens nearing expiry (they last 60 days
//    and die silently otherwise). 2. Snapshots each account's follower count
//    for growth tracking.
//
// Protected by CRON_SECRET — Vercel Cron sends it as "Authorization: Bearer ...".

const GRAPH = "https://graph.instagram.com/v24.0"
const REFRESH_THRESHOLD_DAYS = 10

export const maxDuration = 60

export async function GET(request: Request) {
  const auth = request.headers.get("authorization")
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await getSupabaseServerClient()
  const { data: users } = await supabase
    .from("users")
    .select("id, access_token, token_expires_at, username")

  const result = { users: users?.length || 0, refreshed: 0, snapshots: 0, errors: 0 }
  const today = new Date().toISOString().slice(0, 10)

  for (const u of users || []) {
    if (!u.access_token) continue
    let token = u.access_token

    // 1. Refresh token if within REFRESH_THRESHOLD_DAYS of expiry
    try {
      const daysLeft = u.token_expires_at
        ? (new Date(u.token_expires_at).getTime() - Date.now()) / 86_400_000
        : 0
      if (daysLeft < REFRESH_THRESHOLD_DAYS) {
        const r = await fetch(
          `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`,
        )
        const d = await r.json()
        if (d.access_token) {
          token = d.access_token
          const expiresIn = d.expires_in || 5_184_000
          await supabase
            .from("users")
            .update({
              access_token: token,
              token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
            })
            .eq("id", u.id)
          result.refreshed++
          console.log(`[v0] 🔄 Token refreshed for ${u.username}: +${Math.round(expiresIn / 86400)}d`)
        } else if (d.error) {
          console.error(`[v0] Token refresh failed for ${u.username}:`, JSON.stringify(d.error))
        }
      }
    } catch (e) {
      result.errors++
      console.error(`[v0] Token refresh error for ${u.username}:`, e)
    }

    // 2. Follower snapshot
    try {
      const r = await fetch(`${GRAPH}/me?fields=followers_count&access_token=${token}`, { cache: "no-store" })
      const d = await r.json()
      if (typeof d.followers_count === "number") {
        await supabase
          .from("follower_snapshots")
          .upsert(
            { user_id: u.id, followers_count: d.followers_count, captured_on: today },
            { onConflict: "user_id,captured_on" },
          )
        result.snapshots++
      }
    } catch (e) {
      result.errors++
      console.error(`[v0] Snapshot error for ${u.username}:`, e)
    }
  }

  console.log("[v0] 📅 Daily cron:", JSON.stringify(result))
  return NextResponse.json({ ok: true, ...result })
}

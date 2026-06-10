import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"

const GRAPH = "https://graph.instagram.com/v24.0"

// Connection health for the dashboard: token validity/expiry, webhook
// subscription status, and when we last received a webhook event.
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId")
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })

    const supabase = await getSupabaseServerClient()
    const { data: user } = await supabase
      .from("users")
      .select("access_token, token_expires_at, last_webhook_at, username")
      .eq("id", userId)
      .single()

    if (!user?.access_token) return NextResponse.json({ error: "Instagram not connected" }, { status: 401 })
    const token = user.access_token

    // Token expiry math
    let daysLeft: number | null = null
    let expired = false
    if (user.token_expires_at) {
      const ms = new Date(user.token_expires_at).getTime() - Date.now()
      daysLeft = Math.floor(ms / 86_400_000)
      expired = ms <= 0
    }

    // Is the token still accepted by Instagram?
    let tokenValid = false
    try {
      const meRes = await fetch(`${GRAPH}/me?fields=user_id&access_token=${token}`, { cache: "no-store" })
      const me = await meRes.json()
      tokenValid = !me.error
    } catch {
      /* network issue — leave false */
    }

    // Webhook subscription status
    let subscribedFields: string[] = []
    let subscriptionOk = false
    try {
      const subRes = await fetch(`${GRAPH}/me/subscribed_apps?access_token=${token}`, { cache: "no-store" })
      const sub = await subRes.json()
      if (!sub.error && Array.isArray(sub.data) && sub.data[0]) {
        subscribedFields = (sub.data[0].subscribed_fields || []).map((f: any) =>
          typeof f === "string" ? f : f?.name,
        ).filter(Boolean)
        subscriptionOk = subscribedFields.includes("comments") || subscribedFields.includes("messages")
      }
    } catch {
      /* leave defaults */
    }

    return NextResponse.json({
      username: user.username,
      token: { expiresAt: user.token_expires_at ?? null, daysLeft, expired, valid: tokenValid },
      subscription: { ok: subscriptionOk, fields: subscribedFields },
      lastEventAt: user.last_webhook_at ?? null,
    })
  } catch (error) {
    console.error("[v0] Health check error:", error)
    return NextResponse.json({ error: "Failed to load health" }, { status: 500 })
  }
}

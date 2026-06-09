/* @ts-nocheck */

// ============================================================
// BACKFILL: Scan past comments and run comment automations on
// any that you haven't replied to yet (within the last N days).
//
// Instagram only allows a PRIVATE reply to a comment within 7 days,
// so the day range is hard-capped at 7. "Unanswered" = no reply from
// your own account (we detect our own username among the replies),
// which prevents double-DMing the same person on repeat scans.
// ============================================================

import { type NextRequest, NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase-server"

const GRAPH = "https://graph.instagram.com/v24.0"
const MAX_DAYS = 7
const MAX_ACTIONS = 50 // safety cap on DMs sent per scan
const MAX_PAGES_PER_MEDIA = 10 // bound comment pagination per post (~500 comments)

const PUBLIC_REPLIES = ["Check your DMs! 📥", "Sent! 🔥", "Check inbox! ✨"]

function matchAutomation(automations: any[], commentText: string, mediaId: string) {
  const text = commentText.toLowerCase().trim()
  const keywordHit = (a: any) =>
    a.trigger_value
      ?.split(",")
      .some((k: string) => new RegExp(`\\b${k.trim()}\\b`, "i").test(text))

  // Priority 1: Reply-All on this specific post
  let match = automations.find((a) => a.specific_media_id === mediaId && a.trigger_type === "reply_all")
  // Priority 2: Specific post + keyword
  if (!match)
    match = automations.find((a) => a.specific_media_id === mediaId && a.trigger_type === "keyword" && keywordHit(a))
  // Priority 3: Global keyword (no specific post)
  if (!match)
    match = automations.find((a) => !a.specific_media_id && a.trigger_type === "keyword" && keywordHit(a))
  return match
}

function buildDmBody(match: any, commentId: string, username: string) {
  const content = match.response_content || {}
  const apiBody: any = { recipient: { comment_id: commentId } }

  if (content.message) {
    apiBody.message = { text: content.message }
  } else if (content.card) {
    const card = content.card
    const element: any = {
      title: card.title,
      buttons: (card.buttons || []).map((b: any) => ({
        type: b.type,
        title: b.title,
        url: b.url || undefined,
        payload: b.payload || undefined,
      })),
    }
    if (card.subtitle) element.subtitle = card.subtitle
    if (card.image_url && card.image_url.startsWith("http")) element.image_url = card.image_url
    apiBody.message = { attachment: { type: "template", payload: { template_type: "generic", elements: [element] } } }
  }

  // Follow gate — send the lock card; real content arrives after "Done ✅"
  // (UNLOCK_CONTENT_<id> postback handled by the webhook).
  if (content.check_follow === true) {
    apiBody.message = {
      attachment: {
        type: "template",
        payload: {
          template_type: "generic",
          elements: [
            {
              title: "🔒 One more step",
              subtitle: `Follow @${username}, then tap Done to unlock it.`,
              buttons: [
                { type: "web_url", url: `https://instagram.com/${username}`, title: "Follow Us" },
                { type: "postback", title: "Done ✅", payload: `UNLOCK_CONTENT_${match.id}` },
              ],
            },
          ],
        },
      },
    }
  }
  return apiBody
}

export async function POST(request: NextRequest) {
  try {
    const { userId, days } = await request.json()
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 })

    const windowDays = Math.min(Math.max(Number(days) || MAX_DAYS, 1), MAX_DAYS)
    const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000

    const supabase = await getSupabaseServerClient()

    const { data: user } = await supabase
      .from("users")
      .select("access_token, username, business_account_id, page_id")
      .eq("id", userId)
      .single()

    if (!user?.access_token) return NextResponse.json({ error: "Instagram not connected" }, { status: 401 })

    const { data: automations } = await supabase
      .from("automations")
      .select("*")
      .eq("user_id", userId)
      .eq("trigger_source", "comment")
      .eq("is_active", true)

    if (!automations?.length) {
      return NextResponse.json({ error: "No active comment automations to run." }, { status: 400 })
    }

    const token = user.access_token
    const myUsername = (user.username || "").toLowerCase()
    const myIds = [user.business_account_id, user.page_id].filter(Boolean).map(String)

    const stats = { scanned: 0, matched: 0, replied: 0, skipped: 0, errors: 0, cappedAt: 0 }

    // 1. Recent media that actually has comments
    const mediaRes = await fetch(
      `${GRAPH}/me/media?fields=id,timestamp,comments_count&limit=50&access_token=${token}`,
      { cache: "no-store" },
    )
    const mediaData = await mediaRes.json()
    if (mediaData.error) {
      return NextResponse.json({ error: mediaData.error.message || "Failed to fetch media" }, { status: 500 })
    }
    const mediaList = (mediaData.data || []).filter((m: any) => (m.comments_count || 0) > 0)

    for (const media of mediaList) {
      if (stats.replied >= MAX_ACTIONS) {
        stats.cappedAt = MAX_ACTIONS
        break
      }

      // 2. Comments on this media — paginate, bounded by MAX_PAGES_PER_MEDIA
      let nextUrl: string | null =
        `${GRAPH}/${media.id}/comments?fields=id,text,timestamp,username,from,replies{username,from}&limit=50&access_token=${token}`
      let page = 0
      let capped = false

      while (nextUrl && page < MAX_PAGES_PER_MEDIA && !capped) {
        page++
        const commentsRes: Response = await fetch(nextUrl, { cache: "no-store" })
        const commentsData: any = await commentsRes.json()
        if (commentsData.error) {
          stats.errors++
          break
        }

        for (const comment of commentsData.data || []) {
          if (stats.replied >= MAX_ACTIONS) {
            stats.cappedAt = MAX_ACTIONS
            capped = true
            break
          }

          // Within the window?
          if (comment.timestamp && new Date(comment.timestamp).getTime() < cutoff) continue
          stats.scanned++

          const text: string = comment.text || ""
          if (!text.trim()) {
            stats.skipped++
            continue
          }

          // Skip our own comments
          const commenter = (comment.username || "").toLowerCase()
          const commenterId = comment.from?.id ? String(comment.from.id) : null
          if (commenter === myUsername || (commenterId && myIds.includes(commenterId))) {
            stats.skipped++
            continue
          }

          // Already replied by us?
          const replies = comment.replies?.data || []
          const weReplied = replies.some(
            (r: any) =>
              (r.username || "").toLowerCase() === myUsername ||
              (r.from?.id && myIds.includes(String(r.from.id))),
          )
          if (weReplied) {
            stats.skipped++
            continue
          }

          // Match a rule
          const match = matchAutomation(automations, text, media.id)
          if (!match) {
            stats.skipped++
            continue
          }
          stats.matched++

          // Public reply
          try {
            const reply = PUBLIC_REPLIES[stats.matched % PUBLIC_REPLIES.length]
            await fetch(`${GRAPH}/${comment.id}/replies?access_token=${encodeURIComponent(token)}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: reply }),
            })
          } catch {
            /* non-fatal: still try the DM */
          }

          // Private reply (DM), with follow gate if configured
          try {
            const apiBody = buildDmBody(match, comment.id, user.username || "us")
            const dmRes = await fetch(`${GRAPH}/me/messages?access_token=${encodeURIComponent(token)}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(apiBody),
            })
            const dmJson = await dmRes.json()
            if (dmJson.error) stats.errors++
            else stats.replied++
          } catch {
            stats.errors++
          }
        }

        nextUrl = commentsData.paging?.next || null
      }
    }

    return NextResponse.json({ success: true, windowDays, ...stats })
  } catch (error: any) {
    console.error("[v0] Scan comments error:", error)
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 })
  }
}

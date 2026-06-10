// Groq AI reply helper. Groq exposes an OpenAI-compatible chat API.
// Returns null on any failure (missing key, API error, empty output) so callers
// can simply skip the AI reply and move on.

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile"
const IG_DM_MAX = 1000 // Instagram DM character limit

export async function generateAiReply(
  userMessage: string,
  aiContext?: string | null,
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey || !userMessage?.trim()) return null

  const system = [
    "You are replying to an Instagram DM on behalf of a creator/business.",
    "Keep replies short, warm, and in a casual Instagram tone — 1-3 sentences, emojis are fine.",
    "Only state offers, prices, links, or facts that appear in the account context below. If you don't know, invite them to reply or check the bio — never invent details.",
    "Reply with the message text only, no preamble or quotation marks.",
    aiContext ? `Account context:\n${aiContext}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMessage.slice(0, 2000) },
        ],
        max_tokens: 300,
        temperature: 0.7,
      }),
    })
    const data = await res.json()
    if (data.error) {
      console.error("[v0] Groq error:", JSON.stringify(data.error))
      return null
    }
    const text: string | undefined = data.choices?.[0]?.message?.content?.trim()
    return text ? text.slice(0, IG_DM_MAX) : null
  } catch (e) {
    console.error("[v0] Groq request failed:", e)
    return null
  }
}

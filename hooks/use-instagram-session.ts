"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"

// Module-level cache of in-flight/completed code exchanges. Survives React
// StrictMode unmount/remount (which resets component refs) and concurrent
// mounts, so a given OAuth code is only ever POSTed once. An Instagram
// authorization code is single-use — a second exchange returns 400
// "This authorization code has been used". Whichever instance is live awaits
// the shared promise and still receives the session.
const codeExchanges = new Map<string, Promise<{ userId: string; username: string } | null>>()

function exchangeCode(code: string) {
    let pending = codeExchanges.get(code)
    if (!pending) {
        pending = (async () => {
            try {
                const res = await fetch("/api/instagram/callback", {
                    method: "POST",
                    body: JSON.stringify({ code }),
                })
                const data = await res.json()
                if (data.success) {
                    localStorage.setItem("ig_user_id", data.userId)
                    localStorage.setItem("ig_username", data.username)
                    return { userId: data.userId, username: data.username }
                }
                return null
            } catch (err) {
                console.error("Login failed:", err)
                // Drop the failed attempt so a later retry can re-exchange.
                codeExchanges.delete(code)
                return null
            }
        })()
        codeExchanges.set(code, pending)
    }
    return pending
}

export function useInstagramSession() {
    const [username, setUsername] = useState<string | null>(null)
    const [userId, setUserId] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    const searchParams = useSearchParams()
    const router = useRouter()

    useEffect(() => {
        const code = searchParams.get("code")

        const handleSession = async () => {
            // CASE A: New Login from Instagram
            if (code) {
                const session = await exchangeCode(code)
                if (session) {
                    setUserId(session.userId)
                    setUsername(session.username)
                    // Remove code from URL
                    router.replace("/dashboard")
                }
            }
            // CASE B: Restore Session from LocalStorage
            else {
                const savedId = localStorage.getItem("ig_user_id")
                const savedName = localStorage.getItem("ig_username")

                if (savedId && savedName) {
                    setUserId(savedId)
                    setUsername(savedName)
                }
            }
            setIsLoading(false)
        }

        handleSession()
    }, [searchParams, router])

    const logout = () => {
        localStorage.removeItem("ig_user_id")
        localStorage.removeItem("ig_username")
        document.cookie = "insta_session=; Max-Age=0; path=/;"
        setUsername(null)
        setUserId(null)
        router.push("/")
    }

    return { userId, username, isLoading, logout }
}

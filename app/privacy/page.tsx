import type React from "react"
import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy — InstaAuto",
  description: "How InstaAuto collects, uses, stores, and deletes your Instagram data.",
}

const LAST_UPDATED = "June 9, 2026"
const CONTACT_EMAIL = "sdhanush13@gmail.com"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-zinc-300">{children}</div>
    </section>
  )
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-black via-zinc-950 to-purple-950/20 text-white">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link
          href="/"
          className="text-sm text-purple-400 transition-colors hover:text-purple-300"
        >
          ← Back to InstaAuto
        </Link>

        <header className="mt-8 space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-zinc-400">Last updated: {LAST_UPDATED}</p>
        </header>

        <div className="mt-10 space-y-10">
          <p className="text-sm leading-relaxed text-zinc-300">
            InstaAuto (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;the Service&rdquo;) is an
            Instagram automation tool that lets creators and businesses connect their Instagram
            professional account to automatically reply to comments, direct messages, and story
            interactions. This policy explains what information we collect when you connect your
            Instagram account, how we use it, how long we keep it, and how you can have it deleted.
            By using InstaAuto you agree to the practices described below.
          </p>

          <Section title="Information We Collect">
            <p>
              When you log in with Instagram, we request only the permissions required to operate
              the automations you configure. Through the Instagram API with Instagram Login we
              access and store:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong className="text-white">Account profile data</strong> — your Instagram
                username, professional account ID, and page ID.
              </li>
              <li>
                <strong className="text-white">Access tokens</strong> — the long-lived OAuth access
                token Instagram issues so we can act on your behalf, along with its expiry date.
              </li>
              <li>
                <strong className="text-white">Comments and messages</strong> — the content of
                comments and direct messages sent to your account that trigger your automations, and
                the responses we send. This is delivered to us in real time via Instagram webhooks.
              </li>
              <li>
                <strong className="text-white">Automation configuration</strong> — the keywords,
                rules, reply templates, and settings you create inside InstaAuto.
              </li>
            </ul>
            <p>
              We do <strong className="text-white">not</strong> collect your Instagram password — all
              authentication is handled by Instagram&rsquo;s OAuth flow.
            </p>
          </Section>

          <Section title="How We Use Your Information">
            <p>We use the information described above solely to provide the Service, specifically to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Authenticate your account and keep your session active.</li>
              <li>Match incoming comments, DMs, and story interactions against the rules you set up.</li>
              <li>Send automated replies and direct messages on your behalf.</li>
              <li>Display your conversations and automation activity inside your dashboard.</li>
            </ul>
            <p>
              We do not use your data for advertising, and we never sell or rent your information to
              third parties.
            </p>
          </Section>

          <Section title="How We Store and Protect Your Data">
            <p>
              Your data is stored in a managed Supabase (PostgreSQL) database hosted on secure cloud
              infrastructure, and the application is served via Vercel. Access tokens and account
              data are accessible only to the application using server-side credentials. We rely on
              encrypted connections (HTTPS/TLS) for all data in transit.
            </p>
          </Section>

          <Section title="Data Sharing">
            <p>
              We share data only with the infrastructure providers that make the Service work —
              namely Meta/Instagram (to send and receive messages on your behalf), Supabase (database
              hosting), and Vercel (application hosting). We do not share your data with any other
              third parties except where required by law.
            </p>
          </Section>

          <Section title="Data Retention and Deletion">
            <p>
              We retain your data only for as long as your account remains connected to InstaAuto.
              You may remove your data at any time by:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                Revoking InstaAuto&rsquo;s access from your Instagram settings (Settings → Apps and
                Websites), which invalidates our access token, and
              </li>
              <li>
                Emailing us at{" "}
                <a className="text-purple-400 hover:text-purple-300" href={`mailto:${CONTACT_EMAIL}`}>
                  {CONTACT_EMAIL}
                </a>{" "}
                with the subject &ldquo;Data Deletion Request&rdquo;. We will permanently delete your
                stored profile data, access tokens, automations, and message history within 30 days
                of the request.
              </li>
            </ul>
          </Section>

          <Section title="Children's Privacy">
            <p>
              InstaAuto is not directed to individuals under the age of 13, and we do not knowingly
              collect personal information from children.
            </p>
          </Section>

          <Section title="Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. When we do, we will revise the
              &ldquo;Last updated&rdquo; date at the top of this page. Continued use of the Service
              after changes take effect constitutes acceptance of the revised policy.
            </p>
          </Section>

          <Section title="Contact Us">
            <p>
              If you have any questions about this Privacy Policy or your data, contact us at{" "}
              <a className="text-purple-400 hover:text-purple-300" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </Section>
        </div>
      </div>
    </main>
  )
}

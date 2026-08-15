"use client";

import * as React from "react";
import { Loader2, Send, Sparkles, Megaphone, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface RecItem {
  title: string;
  location?: string;
  price?: number;
  unit?: string;
  image?: string;
  href?: string;
}

const TEMPLATES: { label: string; subject: string; message: string }[] = [
  {
    label: "Come back & explore",
    subject: "New stays & tours just added on Rego ✨",
    message:
      "It's been a while! We've added new verified hotels, jeeps, guides and tour packages across Gilgit-Baltistan. Take a look at some hand-picked recommendations below and plan your next trip in minutes.",
  },
  {
    label: "Seasonal reminder",
    subject: "Planning a Gilgit-Baltistan trip this season?",
    message:
      "The season is perfect for travel. Book verified hotels, transport and guides in one place on Rego. Here are a few top-rated picks to get you started.",
  },
  {
    label: "Blank",
    subject: "",
    message: "",
  },
];

export function AdminBroadcast() {
  const [subject, setSubject] = React.useState(TEMPLATES[0].subject);
  const [message, setMessage] = React.useState(TEMPLATES[0].message);
  const [includeRecs, setIncludeRecs] = React.useState(true);
  const [includeAdmins, setIncludeAdmins] = React.useState(false);
  const [sendEmail, setSendEmail] = React.useState(true);
  const [sendInApp, setSendInApp] = React.useState(true);
  const [testEmail, setTestEmail] = React.useState("");
  const [busy, setBusy] = React.useState<"" | "test" | "all">("");
  const [note, setNote] = React.useState<{ ok: boolean; text: string } | null>(null);

  const applyTemplate = (t: (typeof TEMPLATES)[number]) => {
    setSubject(t.subject);
    setMessage(t.message);
  };

  const send = async (mode: "test" | "all") => {
    setNote(null);
    if (!subject.trim() || !message.trim()) {
      setNote({ ok: false, text: "Please fill in a subject and a message." });
      return;
    }
    if (mode === "test" && !testEmail.trim()) {
      setNote({ ok: false, text: "Enter a test email address first." });
      return;
    }
    if (!sendEmail && !sendInApp) {
      setNote({ ok: false, text: "Pick at least one channel: email or in-site." });
      return;
    }
    if (mode === "all" && !window.confirm("Send this to ALL registered users? This cannot be undone.")) {
      return;
    }
    setBusy(mode);
    try {
      // Fetch current recommendations to attach as cards (optional).
      let items: RecItem[] = [];
      if (includeRecs) {
        try {
          const r = await fetch("/api/recommendations");
          const d = await r.json();
          if (d?.ok) {
            items = (d.items ?? []).slice(0, 6).map((i: RecItem) => ({
              title: i.title,
              location: i.location,
              price: i.price,
              unit: i.unit,
              image: i.image,
              href: i.href,
            }));
          }
        } catch {
          /* ignore — send without cards */
        }
      }

      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setNote({ ok: false, text: "Your session expired. Please sign in again." });
        setBusy("");
        return;
      }

      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subject: subject.trim(),
          heading: subject.trim(),
          message: message.trim(),
          includeAdmins,
          items,
          sendEmail,
          sendInApp,
          testTo: mode === "test" ? testEmail.trim() : undefined,
        }),
      });
      const json = await res.json().catch(() => ({ ok: false }));
      if (json.ok) {
        setNote({
          ok: true,
          text: json.test
            ? `Test email sent to ${testEmail.trim()}.`
            : `Done — ${json.sent ?? 0} email${json.sent === 1 ? "" : "s"} sent, ${json.inApp ?? 0} in-site notification${json.inApp === 1 ? "" : "s"} posted (of ${json.total} users).`,
        });
      } else {
        setNote({ ok: false, text: json.error || "Could not send. Please try again." });
      }
    } catch {
      setNote({ ok: false, text: "Something went wrong. Please try again." });
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold text-forest">Send Notification / Reminder</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Email a reminder or recommendations to everyone who registered on Rego. Attach current
          top-rated picks automatically. Always send a test to yourself first.
        </p>
      </div>

      <div className="rounded-3xl border border-border bg-card p-5 shadow-premium">
        {/* Templates */}
        <div className="flex flex-wrap gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              onClick={() => applyTemplate(t)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-forest hover:border-gold/60 hover:text-gold"
            >
              {t.label}
            </button>
          ))}
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Subject</span>
          <input
            className="auth-input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. New stays & tours just added on Rego"
            maxLength={200}
          />
        </label>

        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Message</span>
          <textarea
            rows={5}
            className="auth-input resize-none"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your reminder / recommendation message…"
            maxLength={5000}
          />
        </label>

        <div className="mt-4 grid gap-2 rounded-2xl border border-border bg-muted/20 p-3 sm:grid-cols-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:col-span-2">
            Channels
          </span>
          <label className="flex items-center gap-2 text-sm text-forest">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
            <Send className="h-4 w-4 text-forest-600" /> Send as email
          </label>
          <label className="flex items-center gap-2 text-sm text-forest">
            <input type="checkbox" checked={sendInApp} onChange={(e) => setSendInApp(e.target.checked)} />
            <Megaphone className="h-4 w-4 text-forest-600" /> Show as in-site notification (bell)
          </label>
        </div>

        <div className="mt-3 space-y-2">
          <label className="flex items-center gap-2 text-sm text-forest">
            <input type="checkbox" checked={includeRecs} onChange={(e) => setIncludeRecs(e.target.checked)} />
            <Sparkles className="h-4 w-4 text-gold" />
            Attach current top-rated recommendations as cards
          </label>
          <label className="flex items-center gap-2 text-sm text-forest">
            <input type="checkbox" checked={includeAdmins} onChange={(e) => setIncludeAdmins(e.target.checked)} />
            Also send to admin accounts
          </label>
        </div>

        {/* Test send */}
        <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-3">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">Send a test first</span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="auth-input flex-1 min-w-[200px]"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="your@email.com"
              type="email"
            />
            <Button
              type="button"
              variant="outline"
              className="rounded-lg"
              disabled={busy !== ""}
              onClick={() => send("test")}
            >
              {busy === "test" ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><Send className="h-4 w-4" /> Send test</>}
            </Button>
          </div>
        </div>

        {/* Send to all */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="gold"
            className="rounded-lg"
            disabled={busy !== ""}
            onClick={() => send("all")}
          >
            {busy === "all" ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><Megaphone className="h-4 w-4" /> Send to all registered users</>}
          </Button>
          {note && (
            <span className={cn("inline-flex items-center gap-1.5 text-sm font-semibold", note.ok ? "text-forest-600" : "text-red-600")}>
              {note.ok && <CheckCircle2 className="h-4 w-4" />}
              {note.text}
            </span>
          )}
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Requires <code>SUPABASE_SERVICE_ROLE_KEY</code> plus mail credentials —
          either <code>SMTP_HOST</code>/<code>SMTP_USER</code>/<code>SMTP_PASSWORD</code>{" "}
          or <code>RESEND_API_KEY</code> — in your server environment. Emails are
          sent from <code>EMAIL_FROM</code>.
        </p>
      </div>
    </div>
  );
}

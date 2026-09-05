"use client";

import * as React from "react";
import { Loader2, Send, Sparkles, Megaphone, CheckCircle2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { categories } from "@/lib/data";

interface RecItem {
  title: string;
  location?: string;
  price?: number;
  unit?: string;
  image?: string;
  href?: string;
}

/* ---------------- audience ---------------- */

type Audience = "all" | "travelers" | "partners" | "category" | "custom";

interface AudienceCounts {
  all: number;
  travelers: number;
  partners: number;
  byCategory: Record<string, number>;
}

const AUDIENCES: { id: Audience; label: string; hint: string }[] = [
  { id: "all", label: "Everyone", hint: "All registered accounts" },
  { id: "travelers", label: "Travellers", hint: "People who book, not partners" },
  { id: "partners", label: "All partners", hint: "Every business account" },
  { id: "category", label: "One service", hint: "e.g. only hotel partners" },
  { id: "custom", label: "Specific people", hint: "Proposals, one-to-one" },
];

/* Same partner categories offered at signup, so the audience list matches
   what business_category can actually contain. */
const partnerCategories = [
  ...categories.filter((c) => c.slug !== "more" && c.slug !== "tours"),
  { slug: "roadside", name: "Roadside Assistance" } as (typeof categories)[number],
  { slug: "coworking", name: "Co-working Space" } as (typeof categories)[number],
];

/** Split a pasted list on commas, semicolons, spaces or new lines. */
/* The same shape the server accepts. They have to agree: the server
   silently drops anything that is not an address, so a client that counts
   everything reports a number nobody will ever be sent to.

   This is not theoretical — a message pasted into the addresses box counted
   as "89 people" because every word between the spaces looked like a
   recipient. The send would have reached nobody and said it reached 89. */
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function parseEmails(raw: string): string[] {
  const seen = new Set<string>();
  return raw
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter((e) => {
      if (!e || !EMAIL_RE.test(e)) return false;
      const k = e.toLowerCase();
      if (seen.has(k)) return false;   // deduped here too, so the count matches
      seen.add(k);
      return true;
    });
}

/** Things typed that are not addresses — worth naming rather than ignoring. */
function countRejected(raw: string): number {
  const all = raw.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
  return all.length - parseEmails(raw).length;
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
  /* Who receives this. "custom" is for proposals / one-to-one outreach. */
  const [audience, setAudience] = React.useState<Audience>("all");
  const [category, setCategory] = React.useState("");
  const [customEmails, setCustomEmails] = React.useState("");
  const [counts, setCounts] = React.useState<AudienceCounts | null>(null);

  /* Load recipient counts once, so the composer can show the blast radius
     before anything is sent. Counts only — no addresses cross the wire. */
  React.useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      try {
        const r = await fetch("/api/admin/audience", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = await r.json();
        if (j?.ok) setCounts(j as AudienceCounts);
      } catch {
        /* count is a nicety — never block sending on it */
      }
    })();
  }, []);

  const reach = React.useMemo(() => {
    if (audience === "custom") return parseEmails(customEmails).length;
    if (!counts) return null;
    if (audience === "all") return counts.all;
    if (audience === "travelers") return counts.travelers;
    if (audience === "partners") return counts.partners;
    return category ? counts.byCategory?.[category] ?? 0 : 0;
  }, [audience, counts, category, customEmails]);

  const reachLabel = React.useMemo(() => {
    if (audience === "category" && !category) return "Choose a category above.";
    if (reach === null) return "Counting recipients…";

    if (audience === "custom") {
      const rejected = countRejected(customEmails);
      if (reach === 0) {
        /* Naming the count is what turns "why does it say nobody" into
           something the admin can act on. Pasting a message here produces
           dozens of rejects and zero recipients. */
        return rejected > 0
          ? `None of the ${rejected} item${rejected === 1 ? "" : "s"} here is an email address. This box takes addresses only — the message goes below.`
          : "Add at least one email address.";
      }
      const skipped =
        rejected > 0
          ? ` ${rejected} entr${rejected === 1 ? "y was" : "ies were"} not an email address and will be skipped.`
          : "";
      return `This will reach ${reach} ${reach === 1 ? "person" : "people"}.${skipped}`;
    }

    if (reach === 0) return "No one matches this audience yet.";
    return `This will reach ${reach} ${reach === 1 ? "person" : "people"}.`;
  }, [audience, category, reach, customEmails]);

  /* What the send button should say. It has to name the audience: a button
     reading "Send to all registered users" on the Specific-people tab offers
     the one thing the admin deliberately did not choose. */
  const sendLabel = React.useMemo(() => {
    switch (audience) {
      case "all":
        return "Send to all registered users";
      case "travelers":
        return "Send to travellers";
      case "partners":
        return "Send to all partners";
      case "category":
        return category ? `Send to ${category.replace(/-/g, " ")} partners` : "Choose a category";
      case "custom":
        return reach === 1 ? "Send to 1 person" : `Send to ${reach ?? 0} people`;
      default:
        return "Send";
    }
  }, [audience, category, reach]);
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
    if (
      mode === "all" &&
      !window.confirm(
        `${reachLabel} This cannot be undone. Send now?`
      )
    ) {
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
          audience,
          category: audience === "category" ? category : undefined,
          emails: audience === "custom" ? parseEmails(customEmails) : undefined,
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

        {/* ---------------- Audience ---------------- */}
        <div className="mt-4 rounded-2xl border border-border bg-muted/30 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-forest">
            <Users className="h-4 w-4 text-forest-600" /> Send to
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            {AUDIENCES.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAudience(a.id)}
                aria-pressed={audience === a.id}
                className={cn(
                  "rounded-xl border px-3 py-2 text-left transition-colors",
                  audience === a.id
                    ? "border-forest-600 bg-forest-50"
                    : "border-border bg-card hover:border-forest/40"
                )}
              >
                <span className="block text-sm font-semibold text-forest">
                  {a.label}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {a.hint}
                </span>
              </button>
            ))}
          </div>

          {audience === "category" && (
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                Which service?
              </span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="auth-input"
              >
                <option value="">Choose a category…</option>
                {partnerCategories.map((c) => {
                  const n = counts?.byCategory?.[c.slug] ?? 0;
                  return (
                    <option key={c.slug} value={c.slug}>
                      {c.name} ({n})
                    </option>
                  );
                })}
              </select>
            </label>
          )}

          {audience === "custom" && (
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">
                Email addresses — separate with commas or new lines
              </span>
              <textarea
                rows={3}
                value={customEmails}
                onChange={(e) => setCustomEmails(e.target.value)}
                placeholder={"owner@hotel.com\npartner@transport.pk"}
                className="auth-input resize-none font-mono text-xs"
              />
              <span className="mt-1 block text-[11px] text-muted-foreground">
                They don&apos;t need a Rego account — useful for proposals and
                partnership offers.
              </span>
            </label>
          )}

          {/* Live count so you know the blast radius before sending. */}
          <p className="mt-3 text-xs font-semibold text-forest-700">
            {reachLabel}
          </p>
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
            /* Nothing to send to is not an error worth a round trip. The
               server refuses an empty recipient list anyway; refusing here
               means the admin finds out before pressing, not after. */
            disabled={busy !== "" || reach === 0 || reach === null}
            onClick={() => send("all")}
          >
            {busy === "all" ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
            ) : (
              /* Follows the audience. It read "Send to all registered users"
                 whatever was selected, which on the Specific-people tab is a
                 button offering to do the one thing the admin did not ask
                 for. */
              <><Megaphone className="h-4 w-4" /> {sendLabel}</>
            )}
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

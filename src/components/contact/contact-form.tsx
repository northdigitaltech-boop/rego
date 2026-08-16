"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { sendEmail } from "@/lib/email";
import { siteConfig } from "@/lib/site";

/** Escape user input before putting it in the HTML email body. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function ContactForm() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);

  const reset = () => {
    setName("");
    setEmail("");
    setSubject("");
    setMessage("");
    setError("");
    setSubmitted(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !email.trim() || !message.trim()) {
      setError("Please fill in your name, email and message.");
      return;
    }

    setBusy(true);
    const line = subject.trim() || "New enquiry";
    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#123">
        <h2 style="margin:0 0 12px;color:#006951">New message from the Rego contact form</h2>
        <p style="margin:0 0 4px"><strong>From:</strong> ${esc(name.trim())}</p>
        <p style="margin:0 0 4px"><strong>Email:</strong>
          <a href="mailto:${esc(email.trim())}">${esc(email.trim())}</a></p>
        <p style="margin:0 0 16px"><strong>Subject:</strong> ${esc(line)}</p>
        <div style="border-left:3px solid #C9A227;padding:8px 0 8px 14px;white-space:pre-wrap">${esc(
          message.trim()
        )}</div>
        <p style="margin-top:20px;font-size:12px;color:#667">
          Reply directly to this email to reach ${esc(name.trim())}.
        </p>
      </div>`;

    // Goes to the address shown on this page, so there's one inbox to watch.
    const ok = await sendEmail(
      siteConfig.contactEmail,
      `[Rego contact] ${line}`,
      html
    );
    setBusy(false);

    if (!ok) {
      setError(
        `We couldn't send that just now. Please email us directly at ${siteConfig.contactEmail}.`
      );
      return;
    }
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="rounded-3xl border border-border/70 bg-forest-50/60 p-8 text-center shadow-premium">
        <CheckCircle2 className="mx-auto h-12 w-12 text-forest-600" />
        <h3 className="mt-4 font-display text-xl font-bold text-forest">
          Message sent
        </h3>
        <p className="mt-2 text-muted-foreground">
          Thanks for reaching out — we&apos;ll reply to{" "}
          <span className="font-semibold text-forest">{email}</span> as soon as we
          can.
        </p>
        <Button variant="outline" className="mt-6" onClick={reset}>
          Send another
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-3xl border border-border/70 bg-card p-6 shadow-premium sm:p-8"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-forest">
            Name <span className="text-gold-600">*</span>
          </span>
          <input
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="auth-input"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-forest">
            Email <span className="text-gold-600">*</span>
          </span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="auth-input"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-forest">
          Subject
        </span>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="How can we help?"
          className="auth-input"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-forest">
          Message <span className="text-gold-600">*</span>
        </span>
        <textarea
          rows={5}
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your message…"
          className="auth-input resize-none"
        />
      </label>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <Button
        type="submit"
        variant="gold"
        size="lg"
        disabled={busy}
        className="w-full rounded-lg"
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Sending…
          </>
        ) : (
          "Send message"
        )}
      </Button>
    </form>
  );
}

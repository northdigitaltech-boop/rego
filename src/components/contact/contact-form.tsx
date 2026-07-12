"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ContactForm() {
  const [submitted, setSubmitted] = React.useState(false);

  if (submitted) {
    return (
      <div className="rounded-3xl border border-border/70 bg-forest-50/60 p-8 text-center shadow-premium">
        <CheckCircle2 className="mx-auto h-12 w-12 text-forest-600" />
        <h3 className="mt-4 font-display text-xl font-bold text-forest">
          Message sent
        </h3>
        <p className="mt-2 text-muted-foreground">
          Thanks for reaching out — we&apos;ll reply as soon as possible. (Demo —
          not connected to a backend yet.)
        </p>
        <Button variant="outline" className="mt-6" onClick={() => setSubmitted(false)}>
          Send another
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
      }}
      className="space-y-4 rounded-3xl border border-border/70 bg-card p-6 shadow-premium sm:p-8"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-forest">
            Name <span className="text-gold-600">*</span>
          </span>
          <input type="text" required placeholder="Your name" className="auth-input" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-forest">
            Email <span className="text-gold-600">*</span>
          </span>
          <input
            type="email"
            required
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
          placeholder="Write your message…"
          className="auth-input resize-none"
        />
      </label>

      <Button type="submit" variant="gold" size="lg" className="w-full rounded-lg">
        Send message
      </Button>
    </form>
  );
}

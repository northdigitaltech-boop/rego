"use client";

import * as React from "react";
import { Mail, Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * NewsletterSection — premium email-capture band for the homepage (above the
 * footer). Client-side validation + inline success state. Wire `onSubscribe`
 * to a real endpoint when available; until then it confirms locally without
 * sending anything (no fake data).
 */
export function NewsletterSection({
  onSubscribe,
  className,
}: {
  onSubscribe?: (email: string) => Promise<void> | void;
  className?: string;
}) {
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<"idle" | "loading" | "done" | "error">("idle");
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) {
      setState("error");
      return;
    }
    setState("loading");
    try {
      await onSubscribe?.(email);
      setState("done");
    } catch {
      setState("error");
    }
  };

  return (
    <section className={cn("bg-background py-12 sm:py-16", className)}>
      <div className="container-px">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-forest-deep px-6 py-12 shadow-premium sm:px-12">
          <div className="relative mx-auto max-w-2xl text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-gold">
              <Mail className="h-6 w-6" />
            </span>
            <h2 className="mt-4 font-display text-2xl font-bold text-white sm:text-3xl">
              Travel smarter with Rego
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-white/70">
              Get seasonal road updates, new stays and the best Gilgit-Baltistan deals — straight to your inbox. No spam, unsubscribe anytime.
            </p>

            {state === "done" ? (
              <p className="mx-auto mt-6 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white">
                <Check className="h-4 w-4 text-gold" /> You&apos;re on the list — thank you!
              </p>
            ) : (
              <form onSubmit={submit} noValidate className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <label htmlFor="newsletter-email" className="sr-only">
                    Email address
                  </label>
                  <input
                    id="newsletter-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (state === "error") setState("idle");
                    }}
                    placeholder="you@example.com"
                    aria-invalid={state === "error"}
                    className="h-12 w-full rounded-xl border border-white/20 bg-white/95 px-4 text-sm text-forest placeholder:text-muted-foreground focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/40"
                  />
                </div>
                <button
                  type="submit"
                  disabled={state === "loading"}
                  className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-gold px-6 text-sm font-bold text-forest-900 shadow-gold-glow transition-opacity hover:opacity-95 disabled:opacity-60"
                >
                  {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Subscribe
                </button>
              </form>
            )}
            {state === "error" && (
              <p className="mt-2 text-xs font-medium text-gold-200">
                Please enter a valid email address.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

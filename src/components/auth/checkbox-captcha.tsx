"use client";

import * as React from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Lightweight "I'm not a robot" checkbox, styled like a classic captcha widget.
 * Adds a small verify delay and gates the form until ticked. This is a basic
 * deterrent (paired with the form's attempt throttle) — for strong bot
 * protection, swap in Cloudflare Turnstile / reCAPTCHA with server verification.
 */
export function CheckboxCaptcha({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const [loading, setLoading] = React.useState(false);

  const handle = () => {
    if (loading) return;
    if (checked) {
      onChange(false);
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onChange(true);
    }, 500);
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white px-4 py-3 shadow-soft">
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label="I'm not a robot"
          onClick={handle}
          className={cn(
            "grid h-6 w-6 place-items-center rounded border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600",
            checked ? "border-forest-600 bg-forest-600 text-white" : "border-muted-foreground/40 bg-white"
          )}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-forest-600" />
          ) : checked ? (
            <Check className="h-4 w-4" strokeWidth={3} />
          ) : null}
        </button>
        <span className="select-none text-sm font-medium text-forest">I&apos;m not a robot</span>
      </div>
      <div className="flex flex-col items-center gap-0.5 text-[9px] leading-none text-muted-foreground">
        <ShieldCheck className="h-5 w-5 text-forest-600" />
        <span className="font-semibold">Rego</span>
        <span>Privacy · Terms</span>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";

/* ============================================================
 * Cloudflare Turnstile widget.
 *
 * The token this produces is passed to Supabase as `options.captchaToken`.
 * Supabase calls Cloudflare's siteverify API itself, which is why the SECRET
 * key lives in the Supabase dashboard (Authentication → Attack Protection)
 * and never in this app.
 *
 * Only NEXT_PUBLIC_TURNSTILE_SITE_KEY is needed here. When it is absent the
 * component renders nothing and `isTurnstileEnabled` is false, so the app
 * keeps working exactly as before.
 * ============================================================ */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export const isTurnstileEnabled = SITE_KEY.length > 0;

interface TurnstileApi {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback?: (token: string) => void;
      "error-callback"?: () => void;
      "expired-callback"?: () => void;
      "timeout-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
      size?: "normal" | "compact" | "flexible";
      action?: string;
appearance?: "always" | "execute" | "interaction-only";
    }
  ) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

/** Load the Turnstile script once, no matter how many widgets mount. */
function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("turnstile")));
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile"));
    document.head.appendChild(s);
  });

  return scriptPromise;
}

export interface TurnstileHandle {
  /** Clear the current token and show a fresh challenge. */
  reset: () => void;
}

export const Turnstile = React.forwardRef<
  TurnstileHandle,
  {
    /** Called with the token, or null when it expires / errors. */
    onToken: (token: string | null) => void;
    /** Labels the challenge in Cloudflare analytics, e.g. "signup". */
    action?: string;
    className?: string;
  }
>(function Turnstile({ onToken, action, className }, ref) {
  const boxRef = React.useRef<HTMLDivElement | null>(null);
  const widgetId = React.useRef<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  // Keep the latest callback without re-rendering the widget.
  const cb = React.useRef(onToken);
  cb.current = onToken;

  React.useImperativeHandle(ref, () => ({
    reset() {
      if (widgetId.current && window.turnstile) {
        window.turnstile.reset(widgetId.current);
        cb.current(null);
      }
    },
  }));

  React.useEffect(() => {
    if (!isTurnstileEnabled) return;
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !boxRef.current || !window.turnstile) return;
        // Guard against double-render under React strict mode.
        if (widgetId.current) return;
        widgetId.current = window.turnstile.render(boxRef.current, {
          sitekey: SITE_KEY,
          action,
          theme: "light",
          size: "flexible",
          callback: (token) => cb.current(token),
          "expired-callback": () => cb.current(null),
          "timeout-callback": () => cb.current(null),
          "error-callback": () => {
            cb.current(null);
            setFailed(true);
          },
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetId.current);
        } catch {
          /* already gone */
        }
        widgetId.current = null;
      }
    };
  }, [action]);

  if (!isTurnstileEnabled) return null;

  return (
    <div className={className}>
      <div ref={boxRef} />
      {failed && (
        <p className="mt-1.5 text-xs font-semibold text-red-600">
          The security check couldn&apos;t load. Please refresh the page or check
          your connection.
        </p>
      )}
    </div>
  );
});

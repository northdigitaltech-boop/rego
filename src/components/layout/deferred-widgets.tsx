"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

/* Routes where a floating button would sit on top of the form the user is
 * trying to fill in — sign-in, sign-up, verification and password reset.
 * Nobody needs "Ask Rego AI" while typing a password. */
const HIDE_ON = [
  "/signin",
  "/signup",
  "/reset-password",
  "/verify",
  "/auth",
  // The security console is an internal tool — a traveller-facing AI chat
  // and 24/7 help-line button have no place in it.
  "/cyber",
];

// Floating widgets aren't needed for first paint, so keep their JS out of the
// initial bundle: load them client-side only, after the page is idle or the
// user first interacts. This trims the critical-path JavaScript significantly.
const RegoAiWidget = dynamic(
  () => import("@/components/home/rego-ai-widget").then((m) => m.RegoAiWidget),
  { ssr: false }
);
const HelpLine = dynamic(
  () => import("@/components/help/help-line").then((m) => m.HelpLine),
  { ssr: false }
);

export function DeferredWidgets() {
  const [show, setShow] = React.useState(false);
  const pathname = usePathname() ?? "";
  const hidden = HIDE_ON.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );

  React.useEffect(() => {
    if (hidden) return;
    let done = false;
    const reveal = () => {
      if (done) return;
      done = true;
      setShow(true);
      cleanup();
    };
    const cleanup = () => {
      window.removeEventListener("scroll", reveal);
      window.removeEventListener("pointerdown", reveal);
      window.removeEventListener("keydown", reveal);
    };
    // Load on first interaction…
    window.addEventListener("scroll", reveal, { once: true, passive: true });
    window.addEventListener("pointerdown", reveal, { once: true });
    window.addEventListener("keydown", reveal, { once: true });
    // …or when the browser goes idle (whichever comes first).
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const id = w.requestIdleCallback
      ? w.requestIdleCallback(reveal)
      : window.setTimeout(reveal, 2500);
    return () => {
      cleanup();
      if (typeof id === "number") window.clearTimeout(id);
    };
  }, [hidden]);

  if (hidden || !show) return null;
  return (
    <>
      <RegoAiWidget />
      <HelpLine />
    </>
  );
}

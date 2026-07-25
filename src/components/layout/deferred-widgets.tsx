"use client";

import * as React from "react";
import dynamic from "next/dynamic";

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

  React.useEffect(() => {
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
  }, []);

  if (!show) return null;
  return (
    <>
      <RegoAiWidget />
      <HelpLine />
    </>
  );
}

"use client";

import * as React from "react";
import dynamic from "next/dynamic";

// Bottom-of-page marketing sections are non-SEO-critical and heavy on animation.
// Code-split them into their own chunks (ssr:false) and mount only when the user
// scrolls near — this keeps their JavaScript out of the initial homepage load.
const AIAssistantCTA = dynamic(
  () => import("@/components/home/ai-assistant-cta").then((m) => m.AIAssistantCTA),
  { ssr: false }
);
const WhyUs = dynamic(() => import("@/components/home/why-us").then((m) => m.WhyUs), {
  ssr: false,
});
const Testimonials = dynamic(
  () => import("@/components/home/testimonials").then((m) => m.Testimonials),
  { ssr: false }
);

export function DeferredMarketing() {
  const ref = React.useRef<HTMLDivElement>(null);
  const [show, setShow] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin: "500px" } // start loading well before it scrolls into view
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} style={show ? undefined : { minHeight: 800 }}>
      {show && (
        <>
          <AIAssistantCTA />
          <WhyUs />
          <Testimonials />
        </>
      )}
    </div>
  );
}

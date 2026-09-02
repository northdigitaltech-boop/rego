"use client";

import * as React from "react";
import dynamic from "next/dynamic";

/* ============================================================
 * FeaturedDroneCreators, loaded only when the reader gets near it.
 *
 * WHY THIS IS SAFE FOR SEO — the usual objection to ssr:false
 *   Nothing is lost from the server HTML, because the component
 *   never put anything there. It fetches its providers and their
 *   portfolios from Supabase in an effect and returns null until
 *   they arrive, so the server already rendered an empty section.
 *   Deferring it removes JavaScript, not content.
 *
 * WHY IT IS WORTH DEFERRING
 *   It sits below seven listing sections — a long way down a page
 *   most visitors never scroll to the end of — yet its code was in
 *   the first bundle the browser had to parse before it could
 *   paint anything at all.
 *
 * This mirrors DeferredMarketing, deliberately: same dynamic import,
 * same 500px lead so the section is ready before it is visible.
 * ============================================================ */

const FeaturedDroneCreators = dynamic(
  () =>
    import("@/components/home/featured-drone-creators").then(
      (m) => m.FeaturedDroneCreators
    ),
  { ssr: false }
);

export function DeferredCreators() {
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
      { rootMargin: "500px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* No minHeight placeholder here, unlike DeferredMarketing: this section
     hides itself entirely when there are no creators to show, so reserving
     space would leave a gap on a page that had none before. */
  return <div ref={ref}>{show && <FeaturedDroneCreators />}</div>;
}

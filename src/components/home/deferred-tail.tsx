"use client";

import * as React from "react";
import dynamic from "next/dynamic";

/* ============================================================
 * The bottom of the homepage, loaded on approach.
 *
 * Same shape as DeferredMarketing, and for the same reason: these
 * sections sit below roughly fifteen others, a phone user may
 * never reach them, and their JavaScript was being downloaded and
 * hydrated on arrival regardless.
 *
 * WHAT IS IN HERE AND WHAT IS NOT
 *   Only sections that carry no SEO weight — platform statistics
 *   and a newsletter form. ssr:false keeps them out of the HTML
 *   entirely, which is exactly wrong for the listing sections
 *   above (hotels, tours, guides) where the whole point is that
 *   Google reads them. Those stay server-rendered.
 *
 *   The rule, stated so the next person does not have to guess:
 *   if a crawler should see it, it does not belong in this file.
 * ============================================================ */

const PlatformStats = dynamic(
  () => import("@/components/home/curated-sections").then((m) => m.PlatformStats),
  { ssr: false }
);

const NewsletterSection = dynamic(
  () => import("@/components/home/newsletter-section").then((m) => m.NewsletterSection),
  { ssr: false }
);

export function DeferredTail() {
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

  /* Reserves height until it mounts. Without it the footer jumps up the page
     and then back down as these load — a layout shift Lighthouse charges for
     and a reader notices. */
  return (
    <div ref={ref} style={show ? undefined : { minHeight: 600 }}>
      {show && (
        <>
          <PlatformStats />
          <NewsletterSection />
        </>
      )}
    </div>
  );
}

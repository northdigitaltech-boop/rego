import type { Metadata } from "next";

import { CyberShell } from "@/components/cyber/cyber-shell";

/* The security portal is entirely separate from /admin: its own layout, its
   own navigation, its own APIs. It deliberately does NOT render the public
   Navbar or Footer. */

export const metadata: Metadata = {
  title: "Security Center",
  // Never let this surface appear in search results.
  robots: { index: false, follow: false, nocache: true },
};

export default function CyberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <CyberShell>{children}</CyberShell>;
}

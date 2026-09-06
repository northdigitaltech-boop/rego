import type { Metadata } from "next";

import { noindexMetadata } from "@/lib/seo";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { PortalShell } from "@/components/portal/portal-shell";

/* Private route — never a search result. Same reasoning as /dashboard:
   robots.txt stops crawling, the meta tag stops indexing, and neither is
   the real protection. my_staff_profile() returns null to everyone who is
   not an active staff member, so the page has nothing to show them. */
export const metadata: Metadata = noindexMetadata("Team portal");

export default function PortalPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background">
        <PortalShell />
      </main>
      <Footer />
    </>
  );
}

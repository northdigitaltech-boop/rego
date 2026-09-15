import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { AdminFlightMarkup } from "@/components/dashboard/admin-flight-markup";
import { flightFlags } from "@/lib/flights/registry";

/* ============================================================
 * /admin/flights/markup
 *
 * A separate route rather than another tab in admin-dashboard.tsx,
 * which is already ~2,700 lines in one client component. Adding
 * eight flight tabs to it would make the hardest file in the
 * project harder.
 *
 * THIS PAGE IS NOT THE ACCESS CONTROL.
 *   The flag check below only decides whether to render. Every
 *   write goes through /api/admin/flight-markup, which reads the
 *   caller's role from the database, and the phase117 policy
 *   limits the table to admins regardless. Someone who reaches
 *   this URL without an admin account gets a screen whose every
 *   action the server refuses.
 * ============================================================ */

export const metadata: Metadata = {
  title: "Flight markup",
  robots: { index: false, follow: false },
};

export default function FlightMarkupPage() {
  if (!flightFlags.enabled()) notFound();

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background">
        <div className="container-px py-8">
          <AdminFlightMarkup />
        </div>
      </main>
      <Footer />
    </>
  );
}

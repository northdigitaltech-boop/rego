import type { Metadata } from "next";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ExpeditionsBrowser } from "@/components/expeditions/expeditions-browser";
import { buildMetadata } from "@/lib/seo";
import {
  getApprovedCompanies, getApprovedPros, getRoles, getPeaks, getRoutes,
} from "@/lib/expeditions";

export const revalidate = 60;

export const metadata: Metadata = buildMetadata({
  title: "Mountaineering & Expedition Services in Gilgit-Baltistan",
  description:
    "Find verified expedition companies, certified mountain guides, high-altitude porters, cooks, camp staff and rescue support for K2, Nanga Parbat, Baltoro and other Gilgit-Baltistan expeditions on Rego.",
  path: "/expeditions",
});

export default async function ExpeditionsPage() {
  const [companies, pros, roles, peaks, routes] = await Promise.all([
    getApprovedCompanies(), getApprovedPros(), getRoles(), getPeaks(), getRoutes(),
  ]);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-muted/30">
        <section className="border-b border-border bg-forest-50/50">
          <div className="container-px py-8">
            <h1 className="font-display text-3xl font-bold text-forest sm:text-4xl">Mountaineering &amp; Expedition Services</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Verified expedition companies, certified guides, high-altitude porters, cooks, camp staff, logistics and rescue support for trekking and climbing across Gilgit-Baltistan.
            </p>
          </div>
        </section>
        <ExpeditionsBrowser companies={companies} pros={pros} roles={roles} peaks={peaks} routes={routes} />
      </main>
      <Footer />
    </>
  );
}

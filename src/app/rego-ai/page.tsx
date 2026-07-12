import { Suspense } from "react";
import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { RegoAiChat } from "@/components/home/rego-ai-chat";

export const metadata: Metadata = {
  title: "Rego AI — Plan your Gilgit-Baltistan trip",
  description:
    "Tell Rego AI what you need — hotels, jeeps, tours, guides or a full day-by-day plan — and get instant recommendations across Gilgit-Baltistan.",
  alternates: { canonical: "/rego-ai" },
};

export default function RegoAiPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-muted/20">
        <section className="bg-gradient-forest text-white">
          <div className="container-px py-10 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-gold backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> Rego AI
            </span>
            <h1 className="mt-3 font-display text-2xl font-bold uppercase sm:text-3xl">
              Your Gilgit-Baltistan trip planner
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-sm text-white/85">
              Ask for stays, transport, tours, guides or a full itinerary — I&apos;ll point you to the right options instantly.
            </p>
          </div>
        </section>

        <section className="container-px py-8">
          <Suspense fallback={<div className="py-20 text-center text-muted-foreground">Loading…</div>}>
            <RegoAiChat />
          </Suspense>
        </section>
      </main>
      <Footer />
    </>
  );
}

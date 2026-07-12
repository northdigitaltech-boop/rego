import type { Metadata } from "next";
import { TrendingUp, Wallet, BarChart3, ShieldCheck } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { PartnerForm } from "@/components/partner/partner-form";

export const metadata: Metadata = {
  title: "Become a Partner",
  description:
    "List your hotel, homestay, tour, transport or service on Rego and reach travelers across Gilgit Baltistan.",
};

const perks = [
  {
    icon: TrendingUp,
    title: "Reach more travelers",
    description: "Get discovered by thousands of visitors planning trips to GB.",
  },
  {
    icon: Wallet,
    title: "Zero setup fees",
    description: "List for free — you only pay a small commission when you earn.",
  },
  {
    icon: BarChart3,
    title: "Simple dashboard",
    description: "Manage bookings, availability and pricing from one place.",
  },
  {
    icon: ShieldCheck,
    title: "Trusted platform",
    description: "Verified badge and secure payments build traveler confidence.",
  },
];

export default function PartnerPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="relative isolate overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div
              className="h-full w-full bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('https://loremflickr.com/1600/700/mountains,hotel,resort?lock=50')",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-forest-900/92 via-forest-900/75 to-forest-900/55" />
          </div>
          <div className="container-px py-16 sm:py-20">
            <div className="max-w-2xl">
              <span className="inline-block rounded-full bg-gold/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-gold">
                Become a Partner
              </span>
              <h1 className="mt-4 font-display text-4xl font-extrabold leading-tight text-white sm:text-5xl">
                Grow your travel business with Rego
              </h1>
              <p className="mt-4 max-w-xl text-lg text-white/85">
                Whether you run a hotel, homestay, tour company, transport service
                or capture memories behind the lens — list with us and start
                earning from travelers exploring Gilgit Baltistan.
              </p>
            </div>
          </div>
        </section>

        {/* Perks */}
        <section className="bg-background py-14">
          <div className="container-px">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {perks.map((p) => {
                const Icon = p.icon;
                return (
                  <div
                    key={p.title}
                    className="rounded-2xl border border-border bg-card p-6 shadow-soft"
                  >
                    <span className="grid h-12 w-12 place-items-center rounded-xl bg-forest-50 text-forest-600">
                      <Icon className="h-6 w-6" />
                    </span>
                    <h3 className="mt-4 font-display text-base font-semibold text-forest">
                      {p.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {p.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Form */}
        <section className="bg-forest-50/50 py-14">
          <div className="container-px">
            <div className="mx-auto max-w-3xl">
              <div className="mb-8 text-center">
                <h2 className="font-display text-3xl font-bold text-forest">
                  List your business
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Fill in the details below and our team will get you set up.
                </p>
              </div>
              <PartnerForm />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

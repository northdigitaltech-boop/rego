"use client";

import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";

const perks = [
  /* No audience figure and no fee or payout promise: those are the
     owner's terms to state (see the Provider Agreement), not copy. */
  "Get found by travellers planning Gilgit-Baltistan trips",
  "Bookings, messages and payments in one dashboard",
  "Approve once — edits and new listings go live right away",
  "Clear terms before you sign up",
];

export function PartnerCta() {
  return (
    <section className="bg-background py-20 sm:py-28">
      <div className="container-px">
        <div className="relative overflow-hidden rounded-3xl bg-forest shadow-card">
          <div
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1523805009345-7448845a9e53?auto=format&fit=crop&w=1600&q=80')",
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-forest via-forest/90 to-forest/60" />

          <div className="relative grid items-center gap-8 p-8 sm:p-12 lg:grid-cols-2 lg:p-16">
            <div
            >
              <span className="inline-block rounded-full bg-gold/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-gold">
                Become a partner
              </span>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight text-white sm:text-4xl">
                Grow your travel business with Rego
              </h2>
              <p className="mt-4 max-w-lg text-white/80">
                Whether you run a boutique lodge, lead unforgettable tours or capture
                memories behind the lens — list your business and start earning today.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button variant="gold" size="lg">
                  List your business
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="border-white/40 text-white hover:bg-white hover:text-forest"
                >
                  How it works
                </Button>
              </div>
            </div>

            <ul
              className="grid gap-3"
            >
              {perks.map((perk) => (
                <li
                  key={perk}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white backdrop-blur"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold text-forest-900">
                    <Check className="h-4 w-4" />
                  </span>
                  <span className="font-medium">{perk}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

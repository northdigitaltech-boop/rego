"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";

const perks = [
  "Reach millions of travelers",
  "Zero setup fees — pay only when you earn",
  "Powerful host dashboard & analytics",
  "Secure payments and instant payouts",
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
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
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
            </motion.div>

            <motion.ul
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
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
            </motion.ul>
          </div>
        </div>
      </div>
    </section>
  );
}

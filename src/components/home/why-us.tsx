"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck, BadgePercent, Users, Lock, Headset, Play } from "lucide-react";

import { Button } from "@/components/ui/button";

const benefits = [
  {
    icon: ShieldCheck,
    title: "Verified Providers",
    description: "Every partner is checked and authenticated before going live.",
  },
  {
    icon: BadgePercent,
    title: "Best Price Guarantee",
    description: "Competitive local prices with no hidden charges.",
  },
  {
    icon: Users,
    title: "Local Experts",
    description: "Real Gilgit-Baltistan hosts, guides and operators.",
  },
  {
    icon: Lock,
    title: "Secure Booking",
    description: "Safe booking with manual payment verification.",
  },
  {
    icon: Headset,
    title: "24/7 Support",
    description: "We're here to help you anytime, anywhere.",
  },
];

export function WhyUs() {
  const reduce = useReducedMotion();
  return (
    <section id="why" className="bg-forest-50/60 py-12 sm:py-16">
      <div className="container-px">
        <h2 className="mb-8 font-display text-xl font-bold uppercase text-forest sm:text-2xl lg:text-3xl">
          Why Choose Rego?
        </h2>

        <div className="grid items-stretch gap-8 lg:grid-cols-2">
          {/* Benefits */}
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
            {benefits.map((b, i) => {
              const Icon = b.icon;
              return (
                <motion.div
                  key={b.title}
                  initial={{ opacity: 0, y: reduce ? 0 : 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: reduce ? 0 : 0.5, delay: reduce ? 0 : i * 0.08 }}
                  className="flex items-start gap-3"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-forest text-gold shadow-premium">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-display text-base font-semibold text-forest">
                      {b.title}
                    </h3>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                      {b.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Plan trip card */}
          <motion.div
            initial={{ opacity: 0, x: reduce ? 0 : 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: reduce ? 0 : 0.6 }}
            className="relative overflow-hidden rounded-3xl shadow-premium-lg ring-1 ring-black/5"
          >
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage:
                  "url('https://picsum.photos/seed/snow-mountain-peak40/1200/800')",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-forest-900/95 via-forest-900/80 to-forest-900/40" />
            <div className="relative flex h-full flex-col justify-center p-8 sm:p-10">
              <h3 className="font-display text-2xl font-bold text-white sm:text-3xl">
                Plan Your Perfect Trip
                <br />
                With <span className="text-gold">Rego</span>
              </h3>
              <p className="mt-3 max-w-sm text-sm text-white/80">
                Everything you need for an unforgettable journey.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-5">
                <Button variant="gold" size="lg" className="rounded-lg">
                  Plan My Trip
                </Button>
                <button type="button" className="flex items-center gap-2 rounded-lg text-sm font-semibold text-white transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-white/15 backdrop-blur">
                    <Play className="h-4 w-4 fill-white" />
                  </span>
                  Watch Video
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

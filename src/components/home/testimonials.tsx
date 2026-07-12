"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Star, ChevronRight } from "lucide-react";

import { testimonials } from "@/lib/data";

export function Testimonials() {
  const reduce = useReducedMotion();
  return (
    <section className="bg-background py-12 sm:py-16">
      <div className="container-px">
        <div className="mb-6 flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-lg font-bold uppercase leading-tight text-forest sm:text-2xl lg:text-3xl">
            What Travelers Say
          </h2>
          <a
            href="#"
            className="flex items-center gap-1 text-sm font-semibold text-forest-600 transition-colors hover:text-gold"
          >
            View All <ChevronRight className="h-4 w-4" />
          </a>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {testimonials.slice(0, 4).map((t, i) => (
            <motion.figure
              key={t.name}
              initial={{ opacity: 0, y: reduce ? 0 : 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: reduce ? 0 : 0.5, delay: reduce ? 0 : i * 0.08 }}
              className="flex flex-col rounded-3xl border border-border/70 bg-card p-6 shadow-premium transition-shadow hover:shadow-premium-lg"
            >
              <div className="flex items-center gap-1">
                {Array.from({ length: t.rating }).map((_, j) => (
                  <Star key={j} className="h-4 w-4 fill-gold text-gold" />
                ))}
              </div>
              <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-forest/85">
                {t.quote}
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3 border-t border-border pt-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={t.avatar}
                  alt={`${t.name} — traveller review`}
                  loading="lazy"
                  decoding="async"
                  className="h-10 w-10 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-semibold text-forest">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.city}</p>
                </div>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

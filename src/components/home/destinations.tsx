"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight } from "lucide-react";

import { destinations as staticDestinations } from "@/lib/data";
import { getDestinations } from "@/lib/destinations";
import { photo } from "@/lib/utils";
import { Reveal } from "@/components/ui/reveal";

const MotionLink = motion.create(Link);

export function Destinations() {
  const reduce = useReducedMotion();
  // Seed with the built-in list, then swap in admin-managed ones if available.
  const [destinations, setDestinations] = React.useState(staticDestinations);

  React.useEffect(() => {
    getDestinations().then(setDestinations);
  }, []);

  return (
    <section id="destinations" className="bg-background py-12 sm:py-16">
      <div className="container-px">
        <Reveal className="mb-6 flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-lg font-bold uppercase leading-tight text-forest sm:text-2xl lg:text-3xl">
            Popular Destinations
          </h2>
          <Link
            href="/destinations"
            className="group inline-flex items-center gap-1 rounded-lg py-1 text-sm font-semibold text-forest-600 transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
          >
            View All Destinations
            <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {destinations.slice(0, 4).map((d, i) => (
            <MotionLink
              key={d.slug}
              href={`/destinations/${d.slug}`}
              initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: reduce ? 0 : 0.5, delay: reduce ? 0 : i * 0.06 }}
              whileHover={reduce ? undefined : { y: -6 }}
              className="group relative block h-44 overflow-hidden rounded-3xl shadow-premium ring-1 ring-black/5 transition-shadow hover:shadow-premium-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2 sm:h-48"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo(d.image, 500)}
                alt={`${d.name}, Gilgit-Baltistan`}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-forest-900/90 via-forest-900/25 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <h3 className="font-display text-lg font-bold text-white">
                  {d.name}
                </h3>
                <p className="mt-0.5 inline-flex rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">
                  {d.stays}
                </p>
              </div>
            </MotionLink>
          ))}
        </div>
      </div>
    </section>
  );
}

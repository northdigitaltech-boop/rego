import type { Metadata } from "next";
import Link from "next/link";
import { Mountain, Home, Search } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";

// The 404 page itself must never be indexed.
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

const QUICK_LINKS = [
  { href: "/destinations", label: "Destinations" },
  { href: "/categories/hotels", label: "Hotels" },
  { href: "/categories/tour-packages", label: "Tour packages" },
  { href: "/activities", label: "Activities" },
  { href: "/safarnama", label: "Travel stories" },
];

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="grid min-h-[70vh] place-items-center bg-forest-50/40 px-6 py-20">
        <div className="text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-forest-600 text-gold">
            <Mountain className="h-9 w-9" strokeWidth={2.2} />
          </span>
          <p className="mt-6 font-display text-6xl font-extrabold text-forest sm:text-7xl">
            404
          </p>
          <h1 className="mt-2 font-display text-2xl font-bold text-forest">
            This trail leads nowhere
          </h1>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or may have moved.
            Let&apos;s get you back on the route.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Button asChild variant="gold" size="lg" className="rounded-lg">
              <Link href="/">
                <Home className="h-5 w-5" /> Back to home
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-lg">
              <Link href="/listings">
                <Search className="h-5 w-5" /> Browse listings
              </Link>
            </Button>
          </div>
          <nav className="mt-8" aria-label="Popular pages">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Popular on Rego</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {QUICK_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-full border border-border bg-card px-4 py-1.5 text-sm font-semibold text-forest transition-colors hover:bg-muted"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>
      </main>
      <Footer />
    </>
  );
}

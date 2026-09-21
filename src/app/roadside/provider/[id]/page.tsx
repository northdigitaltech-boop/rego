import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { RoadsideProviderProfile } from "@/components/roadside/provider-profile";
import {
  getRoadsideProviderById,
  getServicesByProvider,
  getReviewsByProvider,
} from "@/lib/roadside";

/* ISR window. Marketplace content changes when a provider lists or an
   admin approves — a few times a day, not every minute. At 60s every
   path regenerated up to 60 times an hour whether anything had changed
   or not, which was the main driver of Vercel Fluid Active CPU.

   This is ISR, not static: the first request after the window still
   serves instantly from cache and refreshes behind it, so nobody waits.
   The visible cost is that a newly approved listing can take this long
   to appear. */
export const revalidate = 600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const provider = await getRoadsideProviderById(id);
  if (!provider) return { title: "Roadside provider" };
  return {
    title: provider.business_name,
    description: `${provider.business_name} — roadside assistance in ${
      provider.city || "Gilgit Baltistan"
    }. Send an emergency request, call or WhatsApp directly.`,
    alternates: { canonical: `/roadside/provider/${id}` },
  };
}

export default async function RoadsideProviderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const provider = await getRoadsideProviderById(id);
  if (!provider || provider.status !== "approved") notFound();

  const [services, reviews] = await Promise.all([
    getServicesByProvider(id),
    getReviewsByProvider(id),
  ]);

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <div className="container-px pt-6">
          <Link
            href="/roadside"
            className="inline-flex items-center gap-1 text-sm font-semibold text-forest-600 hover:text-gold"
          >
            <ChevronLeft className="h-4 w-4" /> Roadside Assistance
          </Link>
        </div>
        <RoadsideProviderProfile provider={provider} services={services} reviews={reviews} />
      </main>
      <Footer />
    </>
  );
}

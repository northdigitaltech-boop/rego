import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { RoadsideProviderList } from "@/components/roadside/provider-list";
import { roadsideCategories } from "@/lib/data";
import {
  getProvidersByService,
  isRoadsideService,
  serviceName,
  SERVICE_SLUGS,
} from "@/lib/roadside";

export const revalidate = 60;

export function generateStaticParams() {
  return SERVICE_SLUGS.map((service) => ({ service }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ service: string }>;
}): Promise<Metadata> {
  const { service } = await params;
  if (!isRoadsideService(service)) return { title: "Roadside Assistance" };
  const name = serviceName(service);
  return {
    title: name,
    description: `Verified ${name} providers across Gilgit Baltistan. Send an emergency request or call directly.`,
    alternates: { canonical: `/roadside/${service}` },
  };
}

export default async function RoadsideServicePage({
  params,
}: {
  params: Promise<{ service: string }>;
}) {
  const { service } = await params;
  if (!isRoadsideService(service)) notFound();

  const meta = roadsideCategories.find((c) => c.slug === service);
  const items = await getProvidersByService(service);

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <div className="container-px pt-6">
          <Link
            href="/roadside"
            className="inline-flex items-center gap-1 text-sm font-semibold text-forest-600 hover:text-gold"
          >
            <ChevronLeft className="h-4 w-4" /> All roadside services
          </Link>
        </div>

        <section className="container-px pb-14 pt-4">
          <div className="flex items-center gap-3">
            {meta && (
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-forest-50 text-forest-600">
                <meta.icon className="h-6 w-6" />
              </span>
            )}
            <div>
              <h1 className="font-display text-2xl font-bold uppercase text-forest sm:text-3xl">
                {serviceName(service)}
              </h1>
              <p className="text-sm text-muted-foreground">
                {items.length} verified provider{items.length === 1 ? "" : "s"} available
              </p>
            </div>
          </div>

          <div className="mt-8">
            <RoadsideProviderList items={items} service={service} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

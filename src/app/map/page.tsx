import type { Metadata } from "next";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { RegoMapDashboard } from "@/components/map/rego-map-dashboard";
import { getPlaces, getRoutes, getAlerts } from "@/lib/rego-map";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Rego Map — Gilgit-Baltistan",
  description:
    "A smart interactive map of Gilgit-Baltistan — explore roads, tourist spots, hotels, hospitals, rescue points, police stations, fuel and more. Check distances, road status and plan safe routes.",
  alternates: { canonical: "/map" },
};

export default async function RegoMapPage() {
  const [places, routes, alerts] = await Promise.all([getPlaces(), getRoutes(), getAlerts()]);
  return (
    <>
      <Navbar fluid />
      <RegoMapDashboard places={places} routes={routes} alerts={alerts} />
      <Footer />
    </>
  );
}

import type { Metadata } from "next";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Dashboard } from "@/components/dashboard/dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Manage your bookings, wishlist and profile on Rego.",
};

export default function DashboardPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background">
        <Dashboard />
      </main>
      <Footer />
    </>
  );
}

import type { Metadata } from "next";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";

export const metadata: Metadata = {
  title: "Admin",
  description: "Rego platform administration.",
};

export default function AdminPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background">
        <AdminDashboard />
      </main>
      <Footer />
    </>
  );
}

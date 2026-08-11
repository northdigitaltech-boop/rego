import type { Metadata } from "next";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { AdminMfaGate } from "@/components/auth/admin-mfa-gate";

export const metadata: Metadata = {
  title: "Admin",
  description: "Rego platform administration.",
};

export default function AdminPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background">
        {/* Two-step verification — admins only. */}
        <AdminMfaGate>
          <AdminDashboard />
        </AdminMfaGate>
      </main>
      <Footer />
    </>
  );
}

"use client";

import { AuthProvider } from "@/components/auth/auth-context";
import { RoleSetupGate } from "@/components/auth/role-setup-gate";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      {/* Accounts created via Google have no role yet — ask once, wherever
          they land, before showing them the site. */}
      <RoleSetupGate>{children}</RoleSetupGate>
    </AuthProvider>
  );
}

"use client";

import * as React from "react";
import { Loader2, AlertCircle, UserRound, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth, type AccountRole } from "@/components/auth/auth-context";
import { BrandLogo } from "@/components/layout/logo";
import { categories, type CategorySlug } from "@/lib/data";
import { cn } from "@/lib/utils";

/* Same list the email signup form offers, so both routes land in the
   same set of partner categories. */
const partnerCategories = [
  ...categories.filter((c) => c.slug !== "more" && c.slug !== "tours"),
  { slug: "roadside", name: "Roadside Assistance" } as (typeof categories)[number],
  { slug: "coworking", name: "Co-working Space" } as (typeof categories)[number],
];

/**
 * Asked once, right after a Google sign-in.
 *
 * Google tells us a name and an email and nothing else — it has no idea
 * whether this person wants to book a trip or list a hotel. Without this
 * step every OAuth account would silently become a traveller and partners
 * could not register with Google at all.
 */
export function RoleSetupGate({ children }: { children: React.ReactNode }) {
  const { user, ready, chooseRole } = useAuth();

  const [role, setRole] = React.useState<AccountRole>("traveler");
  const [businessCategory, setBusinessCategory] = React.useState<CategorySlug | "">("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  // Only signed-in accounts that never picked a role are held here.
  const needsSetup = ready && !!user && !user.roleChosen && user.role !== "admin";
  if (!needsSetup) return <>{children}</>;

  const submit = async () => {
    setError("");
    if (role === "partner" && !businessCategory) {
      setError("Please choose the category you want to register under.");
      return;
    }
    setBusy(true);
    try {
      await chooseRole(
        role,
        role === "partner" ? (businessCategory as CategorySlug) : undefined
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    /* Forest gradient, matching the sign-in brand panel — and the white
       Rego mark only reads properly on a dark background. */
    <div className="flex min-h-screen items-center justify-center bg-gradient-forest px-5 py-10">
      <div className="w-full max-w-md">
        <BrandLogo className="mx-auto h-16 w-auto" />

        <h1 className="mt-6 text-center font-display text-2xl font-bold text-white">
          Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="mt-1.5 text-center text-sm text-white/80">
          One quick question before you start.
        </p>

        <div className="mt-6 rounded-3xl bg-card p-5 shadow-premium-lg sm:p-6">
          <p className="mb-2 text-sm font-semibold text-forest">
            How will you use Rego?
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRole("traveler")}
              aria-pressed={role === "traveler"}
              className={cn(
                "rounded-xl border px-4 py-4 text-left transition-colors",
                role === "traveler"
                  ? "border-forest-600 bg-forest-50"
                  : "border-border bg-white hover:border-forest/40"
              )}
            >
              <UserRound
                className={cn(
                  "h-5 w-5",
                  role === "traveler" ? "text-forest-600" : "text-muted-foreground"
                )}
              />
              <span className="mt-2 block text-sm font-semibold text-forest">
                Traveller
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Book trips across Gilgit-Baltistan
              </span>
            </button>

            <button
              type="button"
              onClick={() => setRole("partner")}
              aria-pressed={role === "partner"}
              className={cn(
                "rounded-xl border px-4 py-4 text-left transition-colors",
                role === "partner"
                  ? "border-forest-600 bg-forest-50"
                  : "border-border bg-white hover:border-forest/40"
              )}
            >
              <Store
                className={cn(
                  "h-5 w-5",
                  role === "partner" ? "text-forest-600" : "text-muted-foreground"
                )}
              />
              <span className="mt-2 block text-sm font-semibold text-forest">
                Business / Partner
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                List my service on Rego
              </span>
            </button>
          </div>

          {role === "partner" && (
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-semibold text-forest">
                What do you offer?
              </span>
              <select
                value={businessCategory}
                onChange={(e) => setBusinessCategory(e.target.value as CategorySlug)}
                className="auth-input"
              >
                <option value="" disabled>
                  Select a category (Hotel, Transport…)
                </option>
                {partnerCategories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="mt-1.5 block text-xs text-muted-foreground">
                You can add more services later from your dashboard.
              </span>
            </label>
          )}

          {error && (
            <p
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          <Button
            variant="gold"
            size="lg"
            disabled={busy}
            onClick={submit}
            className="mt-5 w-full rounded-lg bg-forest-600 text-white hover:bg-forest-700"
          >
            {busy ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Setting up…</>
            ) : (
              "Continue"
            )}
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-white/70">
          Signed in as {user?.email}
        </p>
      </div>
    </div>
  );
}

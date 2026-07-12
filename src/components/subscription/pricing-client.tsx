"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, ShieldAlert, Loader2, Home } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { useAuth } from "@/components/auth/auth-context";
import {
  getPlatformSettings, getVisiblePlans, getAllPlans, canViewPricing, resolvedPrice,
  effectiveMonthly, additionalYearlySaving,
  type PlatformSettings, type SubscriptionPlan,
} from "@/lib/subscription";
import { cn } from "@/lib/utils";

export function PricingClient() {
  const { user } = useAuth();
  const params = useSearchParams();
  const [settings, setSettings] = React.useState<PlatformSettings | null>(null);
  const [plans, setPlans] = React.useState<SubscriptionPlan[]>([]);
  const [cycle, setCycle] = React.useState<"monthly" | "yearly">("yearly");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      const s = await getPlatformSettings();
      setSettings(s);
      // Admins get all plans (incl. hidden) for preview; public gets visible ones.
      const list = user?.role === "admin" ? await getAllPlans() : await getVisiblePlans();
      setPlans(list.filter((p) => p.is_active));
      setLoading(false);
    })();
  }, [user?.role]);

  if (loading || !settings) {
    return (
      <>
        <Navbar />
        <main className="grid min-h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-forest-600" /></main>
        <Footer />
      </>
    );
  }

  const gate = canViewPricing(settings, { email: user?.email, role: user?.role });
  const wantsPreview = params.get("mode") === "admin-preview";
  const isPreview = gate.preview || (wantsPreview && user?.role === "admin" && settings.admin_preview_enabled);

  // Hidden from anyone not allowed — acts as a soft 404 (and RLS also blocks the data).
  if (!gate.visible) {
    return (
      <>
        <Navbar />
        <main className="grid min-h-[70vh] place-items-center px-6 text-center">
          <div>
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-muted text-muted-foreground"><ShieldAlert className="h-7 w-7" /></span>
            <h1 className="mt-4 font-display text-2xl font-bold text-forest">Page not available</h1>
            <p className="mt-2 text-sm text-muted-foreground">This page isn&apos;t available right now.</p>
            <Link href="/" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-forest px-5 py-2.5 text-sm font-semibold text-white"><Home className="h-4 w-4" /> Back to home</Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />

      {isPreview && (
        <div className="sticky top-0 z-[70] flex items-center justify-center gap-2 bg-gold px-4 py-2.5 text-center text-sm font-semibold text-forest-900">
          <ShieldAlert className="h-4 w-4" />
          ADMIN PREVIEW MODE — this pricing page is not visible to customers or business owners. No real payment will be processed.
        </div>
      )}

      <main className="min-h-screen bg-muted/30">
        <section className="container-px py-14 sm:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-block rounded-full bg-gold/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-gold-700">Rego Business Plans</span>
            <h1 className="mt-4 font-display text-3xl font-bold text-forest sm:text-4xl">Grow your business on Rego</h1>
            <p className="mt-3 text-[15px] text-muted-foreground">Choose the plan that fits your business. Switch or cancel anytime.</p>
          </div>

          <div className="mt-8 flex items-center justify-center gap-3">
            <BillingToggle cycle={cycle} onChange={setCycle} />
          </div>

          {plans.length === 0 ? (
            <p className="mx-auto mt-10 max-w-md rounded-2xl border border-dashed border-border bg-card py-10 text-center text-sm text-muted-foreground">
              No plans to display yet.{user?.role === "admin" ? " Add plans in Admin → Subscription & Monetization." : ""}
            </p>
          ) : (
            <div className="mx-auto mt-10 grid max-w-6xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {plans.map((p) => (
                <PlanCard key={p.id} plan={p} cycle={cycle} isPreview={isPreview} />
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </>
  );
}

function BillingToggle({ cycle, onChange }: { cycle: "monthly" | "yearly"; onChange: (c: "monthly" | "yearly") => void }) {
  return (
    <div className="inline-flex rounded-full border border-border bg-card p-1">
      {(["monthly", "yearly"] as const).map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={cn("rounded-full px-5 py-2 text-sm font-semibold transition-colors", cycle === c ? "bg-gradient-forest text-white shadow-soft" : "text-forest hover:bg-muted")}
        >
          {c === "monthly" ? "Monthly" : "Yearly"}
          {c === "yearly" && <span className="ml-1.5 rounded-full bg-gold/20 px-1.5 py-0.5 text-[10px] font-bold text-gold-700">Save more</span>}
        </button>
      ))}
    </div>
  );
}

function PlanCard({ plan, cycle, isPreview }: { plan: SubscriptionPlan; cycle: "monthly" | "yearly"; isPreview: boolean }) {
  const price = resolvedPrice(plan, cycle);
  const cur = plan.currency;
  const fmt = (n: number) => n.toLocaleString();
  const yMonthly = effectiveMonthly(plan.yearly_discounted_price ?? plan.yearly_original_price);
  const extra = additionalYearlySaving(plan.monthly_discounted_price ?? plan.monthly_original_price, plan.yearly_discounted_price ?? plan.yearly_original_price);

  return (
    <div className={cn("relative flex flex-col rounded-3xl border bg-card p-6 shadow-soft", plan.is_recommended ? "border-gold ring-2 ring-gold/30" : "border-border/70")}>
      {(plan.badge_text || plan.is_recommended) && (
        <span className="absolute -top-3 left-6 rounded-full bg-gradient-gold px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-forest-900 shadow-gold-glow">
          {plan.badge_text || "Recommended"}
        </span>
      )}
      <h3 className="font-display text-lg font-bold text-forest">{plan.name}</h3>
      {plan.short_description && <p className="mt-1 text-sm text-muted-foreground">{plan.short_description}</p>}

      <div className="mt-4">
        {price.discounted && price.original > price.final && (
          <p className="text-sm text-muted-foreground line-through">{cur} {fmt(price.original)}</p>
        )}
        <p className="font-display text-3xl font-bold text-forest">
          {cur} {fmt(price.final)}
          <span className="text-sm font-medium text-muted-foreground">/{cycle === "monthly" ? "mo" : "yr"}</span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {price.pct > 0 && <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-bold text-gold-700">{price.pct}% OFF</span>}
          {price.offerLabel && <span className="text-xs font-semibold text-forest-600">{price.offerLabel}</span>}
        </div>
        {cycle === "yearly" && yMonthly > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">≈ {cur} {fmt(yMonthly)}/month{extra > 0 ? ` · save an extra ${cur} ${fmt(extra)} vs monthly` : ""}</p>
        )}
      </div>

      {plan.features?.length > 0 && (
        <ul className="mt-5 space-y-2">
          {plan.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-forest">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" /> {f}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <button
          disabled={isPreview}
          className={cn("w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity", plan.is_recommended ? "bg-gradient-gold text-forest-900" : "bg-gradient-forest text-white", isPreview && "cursor-not-allowed opacity-70")}
        >
          {plan.cta_text || (cycle === "yearly" ? "Choose Yearly Plan" : "Choose Monthly Plan")}
        </button>
        {isPreview && <p className="mt-2 text-center text-xs text-muted-foreground">Preview Mode — no payment will be processed</p>}
      </div>
    </div>
  );
}

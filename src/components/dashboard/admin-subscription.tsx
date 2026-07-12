"use client";

import * as React from "react";
import { Save, Eye, Plus, Trash2, Loader2, Check, Info, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-context";
import {
  getPlatformSettings, savePlatformSettings, getAllPlans, savePlan, deletePlan,
  logSubscriptionAction, discountPct, effectiveMonthly, additionalYearlySaving,
  type PlatformSettings, type SubscriptionPlan,
} from "@/lib/subscription";

/* ---------------- helpers ---------------- */
function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-forest">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cnx("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors", checked ? "bg-forest-600" : "bg-muted-foreground/30")}
      >
        <span className={cnx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", checked ? "left-[22px]" : "left-0.5")} />
      </button>
    </label>
  );
}
function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-forest">{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="auth-input" />
    </label>
  );
}
function cnx(...c: (string | false | undefined)[]) { return c.filter(Boolean).join(" "); }

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "";

export function AdminSubscription() {
  const { user } = useAuth();
  const [s, setS] = React.useState<PlatformSettings | null>(null);
  const [plans, setPlans] = React.useState<SubscriptionPlan[]>([]);
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [editing, setEditing] = React.useState<Partial<SubscriptionPlan> | null>(null);

  const load = React.useCallback(async () => {
    setS(await getPlatformSettings());
    setPlans(await getAllPlans());
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const patch = (p: Partial<PlatformSettings>) => setS((prev) => (prev ? { ...prev, ...p } : prev));

  const saveSettings = async () => {
    if (!s) return;
    setStatus("saving");
    const { error } = await savePlatformSettings(s, user?.email);
    if (!error) await logSubscriptionAction({ admin_id: user?.email, action: "update_settings", entity_type: "platform_settings", new_value: s });
    setStatus(error ? "error" : "saved");
    if (!error) setTimeout(() => setStatus("idle"), 2500);
  };

  const openPreview = () => {
    const url = `${SITE}/pricing?mode=admin-preview`;
    window.open(url, "_blank", "noopener");
  };

  if (!s) return <div className="grid h-40 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-forest-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-forest">Subscription &amp; Monetization</h2>
          <p className="text-sm text-muted-foreground">Private controls. Nothing here is visible to customers or owners until you launch.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openPreview}><Eye className="h-4 w-4" /> Preview Pricing Page</Button>
          <Button variant="gold" onClick={saveSettings} disabled={status === "saving"}>
            {status === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings
          </Button>
        </div>
      </div>

      {/* Live status banner */}
      <div className={cnx("flex items-start gap-2 rounded-xl border p-3 text-sm",
        s.public_pricing_visible ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800")}>
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        {s.public_pricing_visible
          ? "LIVE: pricing is publicly visible to customers/owners."
          : "HIDDEN: subscriptions are OFF and free access is ON. Only you (admin) can preview pricing."}
        {status === "saved" && <span className="ml-auto inline-flex items-center gap-1 font-semibold text-emerald-700"><Check className="h-4 w-4" /> Saved</span>}
      </div>

      {/* System controls */}
      <section>
        <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-forest">System Controls</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle label="Subscription System" hint="Master switch for paid plans" checked={s.subscription_enabled} onChange={(v) => patch({ subscription_enabled: v })} />
          <Toggle label="Free Access Mode" hint="Everyone keeps full free access" checked={s.free_access_enabled} onChange={(v) => patch({ free_access_enabled: v })} />
          <Toggle label="Public Pricing Visibility" hint="Show the pricing page to everyone" checked={s.public_pricing_visible} onChange={(v) => patch({ public_pricing_visible: v })} />
          <Toggle label="Admin Preview Mode" hint="Only admins can preview pricing" checked={s.admin_preview_enabled} onChange={(v) => patch({ admin_preview_enabled: v })} />
          <Toggle label="Test Checkout Mode" hint="Simulated checkout, no real payment" checked={s.test_checkout_enabled} onChange={(v) => patch({ test_checkout_enabled: v })} />
          <Toggle label="Payment Collection" hint="Enable the live payment gateway" checked={s.payment_enabled} onChange={(v) => patch({ payment_enabled: v })} />
          <Toggle label="Show Subscription Menu to Owners" checked={s.owner_subscription_menu_visible} onChange={(v) => patch({ owner_subscription_menu_visible: v })} />
          <Toggle label="Show Pricing Link in Navbar" checked={s.navbar_pricing_visible} onChange={(v) => patch({ navbar_pricing_visible: v })} />
          <Toggle label="Show Free Launch Banner" checked={s.free_launch_banner_visible} onChange={(v) => patch({ free_launch_banner_visible: v })} />
        </div>
      </section>

      {/* Launch controls */}
      <section>
        <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-forest">Launch Controls</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Free access start" type="date" value={s.free_access_start_date ?? ""} onChange={(v) => patch({ free_access_start_date: v || null })} />
          <Field label="Free access end" type="date" value={s.free_access_end_date ?? ""} onChange={(v) => patch({ free_access_end_date: v || null })} />
          <Field label="Subscription launch date" type="date" value={s.subscription_launch_date ?? ""} onChange={(v) => patch({ subscription_launch_date: v || null })} />
          <Field label="Grace period (days)" type="number" value={String(s.grace_period_days)} onChange={(v) => patch({ grace_period_days: Number(v) || 0 })} />
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-forest">Apply paid plans to</span>
            <select value={s.apply_paid_plans_to} onChange={(e) => patch({ apply_paid_plans_to: e.target.value as PlatformSettings["apply_paid_plans_to"] })} className="auth-input">
              <option value="new_owners">New owners only</option>
              <option value="existing_owners">Existing owners only</option>
              <option value="all_owners">All owners</option>
              <option value="test_accounts">Selected test accounts only</option>
            </select>
          </label>
        </div>
      </section>

      {/* Announcement */}
      <section>
        <h3 className="mb-3 font-display text-sm font-bold uppercase tracking-wide text-forest">Announcement</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle label="Show Announcement" checked={s.announcement_enabled} onChange={(v) => patch({ announcement_enabled: v })} />
          <div />
          <Field label="Title" value={s.announcement_title ?? ""} onChange={(v) => patch({ announcement_title: v })} />
          <Field label="Message" value={s.announcement_message ?? ""} onChange={(v) => patch({ announcement_message: v })} />
          <Field label="Start date" type="date" value={s.announcement_start_date ?? ""} onChange={(v) => patch({ announcement_start_date: v || null })} />
          <Field label="End date" type="date" value={s.announcement_end_date ?? ""} onChange={(v) => patch({ announcement_end_date: v || null })} />
        </div>
      </section>

      {/* Plans manager */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-forest">Plans &amp; Pricing</h3>
          <Button variant="outline" onClick={() => setEditing({ name: "", currency: "PKR", is_active: true, is_visible: true, monthly_enabled: true, yearly_enabled: true, features: [], limitations: [], display_order: plans.length })}>
            <Plus className="h-4 w-4" /> Add plan
          </Button>
        </div>
        {plans.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/40 py-8 text-center text-sm text-muted-foreground">No plans yet. Add one to preview the pricing page.</p>
        ) : (
          <div className="space-y-2">
            {plans.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-forest">{p.name} {!p.is_visible && <span className="text-xs text-muted-foreground">(hidden)</span>} {!p.is_active && <span className="text-xs text-red-500">(inactive)</span>}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.currency} {p.monthly_discounted_price ?? p.monthly_original_price ?? "—"}/mo · {p.currency} {p.yearly_discounted_price ?? p.yearly_original_price ?? "—"}/yr
                  </p>
                </div>
                <button onClick={() => setEditing(p)} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-forest hover:bg-muted" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                <button onClick={async () => { if (confirm(`Delete plan "${p.name}"?`)) { await deletePlan(p.id); load(); } }} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-red-500 hover:bg-red-50" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      {editing && <PlanEditor plan={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} adminEmail={user?.email} />}
    </div>
  );
}

/* ---------------- plan editor modal ---------------- */
function PlanEditor({ plan, onClose, onSaved, adminEmail }: { plan: Partial<SubscriptionPlan>; onClose: () => void; onSaved: () => void; adminEmail?: string }) {
  const [p, setP] = React.useState<Partial<SubscriptionPlan>>(plan);
  const [saving, setSaving] = React.useState(false);
  const set = (patch: Partial<SubscriptionPlan>) => setP((prev) => ({ ...prev, ...patch }));

  const mPct = discountPct(p.monthly_original_price ?? undefined, p.monthly_discounted_price ?? undefined);
  const yPct = discountPct(p.yearly_original_price ?? undefined, p.yearly_discounted_price ?? undefined);
  const yMonthly = effectiveMonthly(p.yearly_discounted_price ?? undefined);
  const extra = additionalYearlySaving(p.monthly_discounted_price ?? undefined, p.yearly_discounted_price ?? undefined);

  const save = async () => {
    if (!p.name?.trim()) { alert("Plan name is required."); return; }
    setSaving(true);
    const { error } = await savePlan({
      ...p,
      monthly_discount_type: p.monthly_discounted_price != null ? "manual" : "none",
      yearly_discount_type: p.yearly_discounted_price != null ? "manual" : "none",
    });
    if (!error) await logSubscriptionAction({ admin_id: adminEmail, action: p.id ? "update_plan" : "create_plan", entity_type: "subscription_plan", entity_id: p.id, new_value: p });
    setSaving(false);
    if (error) alert("Save failed."); else onSaved();
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-card p-6 shadow-premium-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-forest">{p.id ? "Edit plan" : "New plan"}</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Plan name *" value={p.name ?? ""} onChange={(v) => set({ name: v })} />
            <Field label="Slug" value={p.slug ?? ""} onChange={(v) => set({ slug: v })} placeholder="rego-pro" />
          </div>
          <Field label="Short description" value={p.short_description ?? ""} onChange={(v) => set({ short_description: v })} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Currency" value={p.currency ?? "PKR"} onChange={(v) => set({ currency: v })} />
            <Field label="Badge text" value={p.badge_text ?? ""} onChange={(v) => set({ badge_text: v })} placeholder="Most Popular" />
            <Field label="Display order" type="number" value={String(p.display_order ?? 0)} onChange={(v) => set({ display_order: Number(v) || 0 })} />
          </div>

          {/* Monthly */}
          <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-forest">Monthly</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Original price" type="number" value={p.monthly_original_price != null ? String(p.monthly_original_price) : ""} onChange={(v) => set({ monthly_original_price: v === "" ? null : Number(v) })} />
              <Field label="Discounted price" type="number" value={p.monthly_discounted_price != null ? String(p.monthly_discounted_price) : ""} onChange={(v) => set({ monthly_discounted_price: v === "" ? null : Number(v) })} />
              <Field label="Offer label" value={p.monthly_offer_label ?? ""} onChange={(v) => set({ monthly_offer_label: v })} placeholder="Introductory Price" />
            </div>
            {mPct > 0 && <p className="mt-1 text-xs font-semibold text-gold-700">Auto discount: {mPct}% OFF</p>}
          </div>

          {/* Yearly */}
          <div className="rounded-xl border border-border/60 bg-muted/40 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-forest">Yearly</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Original price" type="number" value={p.yearly_original_price != null ? String(p.yearly_original_price) : ""} onChange={(v) => set({ yearly_original_price: v === "" ? null : Number(v) })} />
              <Field label="Discounted price" type="number" value={p.yearly_discounted_price != null ? String(p.yearly_discounted_price) : ""} onChange={(v) => set({ yearly_discounted_price: v === "" ? null : Number(v) })} />
              <Field label="Offer label" value={p.yearly_offer_label ?? ""} onChange={(v) => set({ yearly_offer_label: v })} placeholder="Founding Partner Offer" />
            </div>
            {yPct > 0 && (
              <p className="mt-1 text-xs font-semibold text-gold-700">
                Auto discount: {yPct}% OFF · ≈ {p.currency} {yMonthly}/month{extra > 0 ? ` · saves ${p.currency} ${extra} vs monthly` : ""}
              </p>
            )}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-forest">Features (one per line)</span>
            <textarea rows={5} value={(p.features ?? []).join("\n")} onChange={(e) => set({ features: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })} className="auth-input resize-y" placeholder="10 active listings&#10;Booking management&#10;Basic analytics" />
          </label>

          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-sm text-forest"><input type="checkbox" checked={!!p.is_active} onChange={(e) => set({ is_active: e.target.checked })} /> Active</label>
            <label className="flex items-center gap-2 text-sm text-forest"><input type="checkbox" checked={!!p.is_visible} onChange={(e) => set({ is_visible: e.target.checked })} /> Visible on pricing page</label>
            <label className="flex items-center gap-2 text-sm text-forest"><input type="checkbox" checked={!!p.is_recommended} onChange={(e) => set({ is_recommended: e.target.checked })} /> Recommended</label>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="gold" onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save plan</Button>
        </div>
      </div>
    </div>
  );
}

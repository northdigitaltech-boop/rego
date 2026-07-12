"use client";

import * as React from "react";
import {
  LayoutDashboard,
  UserRound,
  LifeBuoy,
  Star,
  LogOut,
  Loader2,
  CheckCircle2,
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  Power,
  Truck,
  Navigation,
  Eye,
  BarChart3,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  ImageUpload,
  AvatarUpload,
  MultiImageUpload,
} from "@/components/ui/image-upload";
import { AccountSecurity } from "@/components/account/account-security";
import { ContactAdminButton } from "@/components/chat/contact-admin-button";
import { OwnerCrm } from "@/components/crm/owner-crm";
import { type User } from "@/components/auth/auth-context";
import {
  getRoadsideProviderByOwner,
  createRoadsideProvider,
  updateRoadsideProvider,
  getServicesByProvider,
  replaceProviderServices,
  getRequestsByOwner,
  setRequestStatus,
  getReviewsByProvider,
  setRoadsideAvailability,
  updateRequestLocation,
  setTrackingActive,
  ROADSIDE_SERVICES,
  serviceName,
  requestStatusLabel,
  type RoadsideProviderRow,
  type RoadsideServiceRow,
  type RoadsideRequestRow,
  type RoadsideReviewRow,
  type RequestStatus,
} from "@/lib/roadside";
import { sendEmail } from "@/lib/email";
import { createTrackingSender } from "@/lib/realtime";
import { cn } from "@/lib/utils";

const splitList = (s: string) =>
  s.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);
const joinList = (a: string[] | null | undefined) => (a ?? []).join(", ");

type Tab = "overview" | "profile" | "requests" | "reviews" | "crm";

const nav: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: Eye },
  { id: "profile", label: "Profile & Services", icon: UserRound },
  { id: "requests", label: "Requests", icon: LifeBuoy },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "crm", label: "CRM & Insights", icon: BarChart3 },
];

export function RoadsideProviderDashboard({
  user,
  onSignOut,
}: {
  user: User;
  onSignOut: () => void;
}) {
  const [tab, setTab] = React.useState<Tab>("profile");
  const [provider, setProvider] = React.useState<RoadsideProviderRow | null>(null);
  const [services, setServices] = React.useState<RoadsideServiceRow[]>([]);
  const [requests, setRequests] = React.useState<RoadsideRequestRow[]>([]);
  const [reviews, setReviews] = React.useState<RoadsideReviewRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const p = await getRoadsideProviderByOwner(user.email);
    setProvider(p);
    if (p) {
      const [s, r, rv] = await Promise.all([
        getServicesByProvider(p.id),
        getRequestsByOwner(user.email),
        getReviewsByProvider(p.id),
      ]);
      setServices(s);
      setRequests(r);
      setReviews(rv);
    }
    setLoading(false);
  }, [user.email]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const toggleAvailability = async () => {
    if (!provider) return;
    const next = provider.availability_status === "available" ? "offline" : "available";
    setProvider({ ...provider, availability_status: next });
    await setRoadsideAvailability(provider.id, next);
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="container-px py-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-forest">
            Roadside Assistance Dashboard
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage your profile, services and incoming emergency requests.
          </p>
        </div>
        {provider && (
          <button
            onClick={toggleAvailability}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-soft transition-colors",
              provider.availability_status === "available"
                ? "bg-green-50 text-green-700 hover:bg-green-100"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            <Power className="h-4 w-4" />
            {provider.availability_status === "available" ? "Available — ON" : "Offline — OFF"}
          </button>
        )}
      </div>

      {provider && provider.status !== "approved" && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your profile is <strong>{provider.status}</strong>. It becomes visible to customers once an
          admin approves it.
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Sidebar */}
        <aside>
          <div className="sticky top-24 rounded-3xl border border-border/70 bg-card p-3 shadow-premium">
            <div className="flex items-center gap-3 border-b border-border p-3">
              <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-gold text-forest-900">
                {provider?.profile_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={provider.profile_image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Truck className="h-6 w-6" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-forest">{provider?.business_name || user.name}</p>
                <span className="mt-1 inline-block rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold-700">
                  Roadside Assistance
                </span>
              </div>
            </div>
            <nav className="mt-2 space-y-1">
              {nav.map((n) => {
                const Icon = n.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => setTab(n.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      tab === n.id ? "bg-gradient-forest text-white shadow-soft" : "text-forest hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {n.label}
                    {n.id === "requests" && pendingCount > 0 && (
                      <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                );
              })}
              <div className="my-2 border-t border-border" />
              <ContactAdminButton ownerEmail={user.email} ownerName={user.name} ownerAvatar={user.avatar} />
              <button
                onClick={onSignOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-forest hover:bg-muted"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </nav>
          </div>
        </aside>

        {/* Content */}
        <div>
          {loading ? (
            <div className="py-20 text-center text-muted-foreground">
              <Loader2 className="mx-auto h-6 w-6 animate-spin" />
              <p className="mt-2">Loading…</p>
            </div>
          ) : (
            <>
              {tab === "overview" && (
                <Overview provider={provider} requests={requests} reviews={reviews} onGo={setTab} />
              )}
              {tab === "profile" && (
                <>
                  <ProfileForm
                    user={user}
                    provider={provider}
                    services={services}
                    onSaved={refresh}
                  />
                  <AccountSecurity />
                </>
              )}
              {tab === "requests" && (
                <RequestsPanel requests={requests} onChange={refresh} />
              )}
              {tab === "reviews" && <ReviewsPanel reviews={reviews} />}
              {tab === "crm" && <OwnerCrm user={user} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Overview ---------------- */

function Overview({
  provider,
  requests,
  reviews,
  onGo,
}: {
  provider: RoadsideProviderRow | null;
  requests: RoadsideRequestRow[];
  reviews: RoadsideReviewRow[];
  onGo: (t: Tab) => void;
}) {
  if (!provider) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 py-16 text-center">
        <Truck className="mx-auto h-10 w-10 text-forest-600" />
        <p className="mt-2 font-display text-lg font-semibold text-forest">
          Set up your roadside profile
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add your business details and services to start receiving requests.
        </p>
        <Button variant="gold" className="mt-4 rounded-lg" onClick={() => onGo("profile")}>
          Create profile
        </Button>
      </div>
    );
  }
  const active = requests.filter((r) => ["pending", "accepted", "on_the_way"].includes(r.status));
  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-3">
        <Stat icon={LifeBuoy} label="Active requests" value={String(active.length)} />
        <Stat icon={CheckCircle2} label="Completed" value={String(requests.filter((r) => r.status === "completed").length)} />
        <Stat icon={Star} label="Rating" value={`${Number(provider.rating).toFixed(1)} (${reviews.length})`} />
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-premium">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-forest">Latest requests</h2>
          <button onClick={() => onGo("requests")} className="text-sm font-semibold text-forest-600 hover:text-gold">
            View all
          </button>
        </div>
        {requests.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No requests yet.</p>
        ) : (
          <div className="mt-3 divide-y divide-border">
            {requests.slice(0, 4).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-forest">
                    {serviceName(r.service_type || "")} · {r.customer_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.request_number} · {r.location_address}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof LifeBuoy; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-premium">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-forest-50 text-forest-600">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 font-display text-2xl font-bold text-forest">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/* ---------------- Profile & Services form ---------------- */

function ProfileForm({
  user,
  provider,
  services,
  onSaved,
}: {
  user: User;
  provider: RoadsideProviderRow | null;
  services: RoadsideServiceRow[];
  onSaved: () => void;
}) {
  const [businessName, setBusinessName] = React.useState(provider?.business_name ?? user.name);
  const [ownerName, setOwnerName] = React.useState(provider?.owner_name ?? "");
  const [phone, setPhone] = React.useState(provider?.phone ?? "");
  const [whatsapp, setWhatsapp] = React.useState(provider?.whatsapp ?? "");
  const [email, setEmail] = React.useState(provider?.email ?? user.email);
  const [address, setAddress] = React.useState(provider?.address ?? "");
  const [city, setCity] = React.useState(provider?.city ?? "");
  const [areas, setAreas] = React.useState(joinList(provider?.service_areas));
  const [responseTime, setResponseTime] = React.useState(provider?.response_time ?? "");
  const [is247, setIs247] = React.useState(provider?.is_24_7 ?? false);
  const [description, setDescription] = React.useState(provider?.description ?? "");
  const [profileImage, setProfileImage] = React.useState(provider?.profile_image ?? "");
  const [coverImage, setCoverImage] = React.useState(provider?.cover_image ?? "");
  const [gallery, setGallery] = React.useState<string[]>(provider?.gallery_images ?? []);
  const [verificationDoc, setVerificationDoc] = React.useState(provider?.verification_doc ?? "");

  // service checkboxes + prices
  const initSel: Record<string, { on: boolean; price: string; desc: string }> = {};
  for (const s of ROADSIDE_SERVICES) {
    const existing = services.find((x) => x.service_type === s.slug);
    initSel[s.slug] = {
      on: !!existing,
      price: existing ? String(existing.starting_price) : "",
      desc: existing?.description ?? "",
    };
  }
  const [sel, setSel] = React.useState(initSel);

  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState("");

  const setService = (slug: string, patch: Partial<{ on: boolean; price: string; desc: string }>) =>
    setSel((prev) => ({ ...prev, [slug]: { ...prev[slug], ...patch } }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!businessName.trim()) {
      setError("Business / provider name is required.");
      return;
    }
    const chosen = ROADSIDE_SERVICES.filter((s) => sel[s.slug].on);
    if (chosen.length === 0) {
      setError("Select at least one service you provide.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        business_name: businessName.trim(),
        owner_name: ownerName.trim() || null,
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        city: city.trim() || null,
        service_areas: splitList(areas),
        response_time: responseTime.trim() || null,
        is_24_7: is247,
        description: description.trim() || null,
        profile_image: profileImage || null,
        cover_image: coverImage || null,
        gallery_images: gallery,
        verification_doc: verificationDoc || null,
        owner_email: user.email,
      };

      let providerId = provider?.id;
      if (provider) {
        const { error: upErr } = await updateRoadsideProvider(provider.id, payload);
        if (upErr) throw upErr;
      } else {
        const { data, error: crErr } = await createRoadsideProvider({
          ...payload,
          status: "pending",
        });
        if (crErr) throw crErr;
        providerId = (data as RoadsideProviderRow)?.id;
      }

      if (providerId) {
        await replaceProviderServices({
          providerId,
          ownerEmail: user.email,
          services: chosen.map((s) => ({
            service_type: s.slug,
            starting_price: Number(sel[s.slug].price) || 0,
            description: sel[s.slug].desc.trim() || null,
          })),
        });
      }
      setSaved(true);
      onSaved();
    } catch {
      setError("Could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-premium sm:p-8">
      <div>
        <h2 className="font-display text-xl font-bold text-forest">
          {provider ? "Edit roadside profile" : "Create your roadside profile"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This powers your public page. New profiles go live once an admin approves them.
        </p>
      </div>

      {/* Images */}
      <div className="flex flex-wrap items-center gap-6">
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-forest">Logo / profile image</span>
          <AvatarUpload value={profileImage} onChange={setProfileImage} />
        </div>
        <div className="flex-1 min-w-[220px]">
          <span className="mb-1.5 block text-sm font-semibold text-forest">Cover image</span>
          <ImageUpload value={coverImage} onChange={setCoverImage} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business / provider name" required>
          <input className="auth-input" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </Field>
        <Field label="Owner name">
          <input className="auth-input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
        </Field>
        <Field label="Phone number">
          <input className="auth-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 3xx xxxxxxx" />
        </Field>
        <Field label="WhatsApp number">
          <input className="auth-input" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
        </Field>
        <Field label="Email">
          <input className="auth-input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="City">
          <input className="auth-input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Gilgit, Skardu…" />
        </Field>
        <Field label="Address">
          <input className="auth-input" value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label="Response time">
          <input className="auth-input" value={responseTime} onChange={(e) => setResponseTime(e.target.value)} placeholder="e.g. 15–30 min" />
        </Field>
      </div>

      <Field label="Service areas (comma separated)">
        <input className="auth-input" value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="Gilgit city, KKH, Hunza…" />
      </Field>

      <label className="flex items-center gap-2 text-sm font-semibold text-forest">
        <input type="checkbox" checked={is247} onChange={(e) => setIs247(e.target.checked)} className="h-4 w-4 rounded border-border" />
        Available 24/7 for emergencies
      </label>

      <Field label="Description / about">
        <textarea rows={4} className="auth-input resize-none" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell customers about your service…" />
      </Field>

      {/* Services + prices */}
      <div>
        <h3 className="font-display text-base font-bold text-forest">Services you provide</h3>
        <p className="text-sm text-muted-foreground">Tick each service and set a starting price.</p>
        <div className="mt-3 space-y-3">
          {ROADSIDE_SERVICES.map((s) => {
            const v = sel[s.slug];
            return (
              <div key={s.slug} className="rounded-xl border border-border p-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-forest">
                  <input
                    type="checkbox"
                    checked={v.on}
                    onChange={(e) => setService(s.slug, { on: e.target.checked })}
                    className="h-4 w-4 rounded border-border"
                  />
                  {s.name}
                </label>
                {v.on && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-muted-foreground">Starting price (PKR)</span>
                      <input
                        type="number"
                        min={0}
                        className="auth-input"
                        value={v.price}
                        onChange={(e) => setService(s.slug, { price: e.target.value })}
                        placeholder="e.g. 1500"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-semibold text-muted-foreground">Short note (optional)</span>
                      <input
                        className="auth-input"
                        value={v.desc}
                        onChange={(e) => setService(s.slug, { desc: e.target.value })}
                        placeholder="Included / conditions"
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Gallery */}
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-forest">Gallery images</span>
        <MultiImageUpload value={gallery} onChange={setGallery} />
      </div>

      {/* Verification doc (optional, private) */}
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-forest">
          Verification document (optional, private)
        </span>
        <ImageUpload value={verificationDoc} onChange={setVerificationDoc} />
        <p className="mt-1 text-xs text-muted-foreground">
          Shared only with admins for verification — never shown to customers.
        </p>
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="gold" className="rounded-lg" disabled={saving}>
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : provider ? "Save changes" : "Create profile"}
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-sm font-medium text-forest-600">
            <CheckCircle2 className="h-4 w-4" /> Saved
          </span>
        )}
      </div>
    </form>
  );
}

/* ---------------- Requests ---------------- */

function RequestsPanel({
  requests,
  onChange,
}: {
  requests: RoadsideRequestRow[];
  onChange: () => void;
}) {
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const update = async (r: RoadsideRequestRow, status: RequestStatus) => {
    setBusyId(r.id);
    await setRequestStatus(r.id, status);
    // Best-effort email to the customer with the new status.
    if (r.customer_email) {
      void sendEmail(
        r.customer_email,
        `Roadside request ${r.request_number} — ${requestStatusLabel(status)}`,
        `<p>Your roadside request <strong>${r.request_number}</strong> is now <strong>${requestStatusLabel(
          status
        )}</strong>.</p>`
      ).catch(() => {});
    }
    await onChange();
    setBusyId(null);
  };

  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 py-16 text-center">
        <LifeBuoy className="mx-auto h-10 w-10 text-forest-600" />
        <p className="mt-2 font-display text-lg font-semibold text-forest">No requests yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Incoming emergency requests will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((r) => (
        <div key={r.id} className="rounded-2xl border border-border bg-card p-5 shadow-premium">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display font-bold text-forest">{serviceName(r.service_type || "")}</p>
                <StatusBadge status={r.status} />
                <UrgencyBadge urgency={r.urgency} />
              </div>
              <p className="mt-0.5 text-xs font-semibold tracking-wider text-forest-600">
                {r.request_number}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {new Date(r.created_at).toLocaleString()}
            </p>
          </div>

          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <Detail icon={UserRound} label="Customer" value={r.customer_name || "—"} />
            <Detail icon={MapPin} label="Location" value={r.location_address || "—"} />
            <Detail icon={Truck} label="Vehicle" value={r.vehicle_type || "—"} />
            <Detail icon={Clock} label="Prefers" value={r.preferred_contact_method || "—"} />
          </div>
          {r.problem_description && (
            <p className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {r.problem_description}
            </p>
          )}
          {r.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.image_url} alt="" className="mt-2 h-32 rounded-lg object-cover" />
          )}

          {/* Contact + actions */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {r.customer_phone && (
              <a href={`tel:${r.customer_phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-forest hover:bg-muted">
                <Phone className="h-4 w-4" /> Call
              </a>
            )}
            {r.customer_whatsapp && (
              <a
                href={`https://wa.me/${r.customer_whatsapp.replace(/[^\d]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-semibold text-green-700 hover:bg-green-100"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            )}
            {r.location_address && (
              <a
                href={`https://www.google.com/maps?q=${encodeURIComponent(r.location_address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-forest hover:bg-muted"
              >
                <Navigation className="h-4 w-4" /> Map
              </a>
            )}
          </div>

          {["accepted", "on_the_way"].includes(r.status) && (
            <div className="mt-3 border-t border-border pt-3">
              <ProviderLocationShare requestId={r.id} />
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
            <StatusActions request={r} busy={busyId === r.id} onSet={(s) => update(r, s)} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Live location sharing (provider) ---------------- */

function ProviderLocationShare({ requestId }: { requestId: string }) {
  const [sharing, setSharing] = React.useState(false);
  const [error, setError] = React.useState("");
  const watchId = React.useRef<number | null>(null);
  const sender = React.useRef<ReturnType<typeof createTrackingSender> | null>(null);
  const lastPersist = React.useRef(0);

  const stop = React.useCallback(async () => {
    if (watchId.current != null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(watchId.current);
    }
    watchId.current = null;
    sender.current?.close();
    sender.current = null;
    setSharing(false);
    await setTrackingActive(requestId, false);
  }, [requestId]);

  const start = () => {
    setError("");
    if (!("geolocation" in navigator)) {
      setError("Location is not supported on this device.");
      return;
    }
    sender.current = createTrackingSender(requestId);
    void setTrackingActive(requestId, true);
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const at = Date.now();
        sender.current?.send({ lat, lng, at });
        // Persist to DB at most every ~15s (for late joiners / reconnects).
        if (at - lastPersist.current > 15000) {
          lastPersist.current = at;
          void updateRequestLocation(requestId, lat, lng);
        }
      },
      () => setError("Location permission denied. Enable it to share your position."),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    setSharing(true);
  };

  // Clean up on unmount.
  React.useEffect(() => {
    return () => {
      if (watchId.current != null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchId.current);
      }
      sender.current?.close();
    };
  }, []);

  return (
    <div>
      <button
        onClick={() => (sharing ? stop() : start())}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
          sharing
            ? "bg-red-50 text-red-600 hover:bg-red-100"
            : "bg-gradient-forest text-white shadow-soft hover:opacity-95"
        )}
      >
        <Navigation className={cn("h-4 w-4", sharing && "animate-pulse")} />
        {sharing ? "Stop sharing location" : "Share live location"}
      </button>
      {sharing && (
        <p className="mt-1.5 text-xs text-forest-600">
          Your live location is visible to this customer. Keep this page open.
        </p>
      )}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function StatusActions({
  request,
  busy,
  onSet,
}: {
  request: RoadsideRequestRow;
  busy: boolean;
  onSet: (s: RequestStatus) => void;
}) {
  const s = request.status;
  const btn = (label: string, status: RequestStatus, cls: string) => (
    <button
      key={status}
      disabled={busy}
      onClick={() => onSet(status)}
      className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-60", cls)}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      {label}
    </button>
  );

  if (s === "completed" || s === "cancelled") {
    return <span className="text-sm text-muted-foreground">Request {requestStatusLabel(s).toLowerCase()}.</span>;
  }
  return (
    <>
      {s === "pending" && btn("Accept", "accepted", "bg-forest-600 text-white hover:bg-forest-700")}
      {(s === "pending") && btn("Reject", "cancelled", "border border-border text-forest hover:bg-muted")}
      {s === "accepted" && btn("Mark on the way", "on_the_way", "bg-gold text-forest-900 hover:opacity-90")}
      {(s === "accepted" || s === "on_the_way") &&
        btn("Complete", "completed", "bg-green-600 text-white hover:bg-green-700")}
      {(s === "accepted" || s === "on_the_way") &&
        btn("Cancel", "cancelled", "border border-red-200 text-red-600 hover:bg-red-50")}
    </>
  );
}

/* ---------------- Reviews ---------------- */

function ReviewsPanel({ reviews }: { reviews: RoadsideReviewRow[] }) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 py-16 text-center">
        <Star className="mx-auto h-10 w-10 text-forest-600" />
        <p className="mt-2 font-display text-lg font-semibold text-forest">No reviews yet</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {reviews.map((r) => (
        <div key={r.id} className="rounded-2xl border border-border bg-card p-4 shadow-premium">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-forest">{r.customer_name || "Customer"}</p>
            <span className="flex items-center gap-1 text-sm font-semibold text-forest">
              <Star className="h-3.5 w-3.5 fill-gold text-gold" /> {r.rating}
            </span>
          </div>
          {r.review_text && <p className="mt-1 text-sm text-muted-foreground">{r.review_text}</p>}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Shared bits ---------------- */

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-forest">
        {label} {required && <span className="text-gold-600">*</span>}
      </span>
      {children}
    </label>
  );
}

function Detail({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium text-forest">{value}</span>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-gold/20 text-gold-700",
    accepted: "bg-forest-50 text-forest-600",
    on_the_way: "bg-blue-50 text-blue-600",
    completed: "bg-green-50 text-green-600",
    cancelled: "bg-red-50 text-red-600",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", map[status] ?? "bg-muted text-forest")}>
      {requestStatusLabel(status)}
    </span>
  );
}

function UrgencyBadge({ urgency }: { urgency: string }) {
  const map: Record<string, string> = {
    normal: "bg-forest-50 text-forest-600",
    urgent: "bg-gold/20 text-gold-700",
    emergency: "bg-red-50 text-red-600",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", map[urgency] ?? "bg-muted")}>
      {urgency}
    </span>
  );
}

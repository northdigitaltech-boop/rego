"use client";

import * as React from "react";
import { useDashboardDrill, DashboardBack } from "@/components/dashboard/dashboard-drill";
import {
  UserRound,
  Briefcase,
  CalendarCheck,
  Star,
  LogOut,
  Loader2,
  CheckCircle2,
  Phone,
  Eye,
  Users,
  BarChart3,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ImageUpload, AvatarUpload, MultiImageUpload } from "@/components/ui/image-upload";
import { AccountSecurity } from "@/components/account/account-security";
import { ContactAdminButton } from "@/components/chat/contact-admin-button";
import { OwnerCrm } from "@/components/crm/owner-crm";
import { type User } from "@/components/auth/auth-context";
import {
  getCoworkingByOwner,
  createCoworking,
  updateCoworking,
  getCoworkingBookingsByOwner,
  setCoworkingBookingStatus,
  coworkingBookingRef,
  planName,
  COWORKING_AMENITIES,
  type CoworkingSpaceRow,
  type CoworkingBookingRow,
} from "@/lib/coworking";
import { getReviews, type ReviewRow } from "@/lib/reviews";
import { sendEmail } from "@/lib/email";
import { cn } from "@/lib/utils";

const splitList = (s: string) => s.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean);
const joinList = (a: string[] | null | undefined) => (a ?? []).join(", ");
const numOrNull = (v: string) => {
  const n = Number(v);
  return v.trim() && !Number.isNaN(n) ? n : null;
};

type Tab = "overview" | "profile" | "inquiries" | "reviews" | "crm";

const nav: { id: Tab; label: string; icon: typeof UserRound }[] = [
  { id: "overview", label: "Overview", icon: Eye },
  { id: "profile", label: "Space Profile", icon: UserRound },
  { id: "inquiries", label: "Booking Requests", icon: CalendarCheck },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "crm", label: "CRM & Insights", icon: BarChart3 },
];

export function CoworkingProviderDashboard({
  user,
  onSignOut,
}: {
  user: User;
  onSignOut: () => void;
}) {
  const [tab, setTab] = React.useState<Tab>("profile");
  const drill = useDashboardDrill();
  const [space, setSpace] = React.useState<CoworkingSpaceRow | null>(null);
  const [bookings, setBookings] = React.useState<CoworkingBookingRow[]>([]);
  const [reviews, setReviews] = React.useState<ReviewRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    const sp = await getCoworkingByOwner(user.email);
    setSpace(sp);
    const [bk, rv] = await Promise.all([
      getCoworkingBookingsByOwner(user.email),
      sp ? getReviews(sp.id) : Promise.resolve([]),
    ]);
    setBookings(bk);
    setReviews(rv);
    setLoading(false);
  }, [user.email]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const pending = bookings.filter((b) => b.status === "pending").length;

  return (
    <div className="container-px py-10">
      <div>
        <h1 className="font-display text-3xl font-bold text-forest">Co-working Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your space profile and incoming booking requests.
        </p>
      </div>

      {space && space.status !== "approved" && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your space is <strong>{space.status}</strong>. It becomes visible to customers once an admin
          approves it.
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr] rego-dash" {...drill.gridProps}>
        <DashboardBack onClick={drill.back} />
        <aside>
          <div className="sticky top-24 rounded-3xl border border-border/70 bg-card p-3 shadow-premium">
            <div className="flex items-center gap-3 border-b border-border p-3">
              <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-gold text-forest-900">
                {space?.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={space.logo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Briefcase className="h-6 w-6" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-forest">{space?.name || user.name}</p>
                <span className="mt-1 inline-block rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold-700">
                  Co-working Space
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
                    {n.id === "inquiries" && pending > 0 && (
                      <span className="ml-auto rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{pending}</span>
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

        <div>
          {loading ? (
            <div className="py-20 text-center text-muted-foreground">
              <Loader2 className="mx-auto h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              {tab === "overview" && <Overview space={space} bookings={bookings} reviews={reviews} onGo={setTab} />}
              {tab === "profile" && (
                <>
                  <ProfileForm user={user} space={space} onSaved={refresh} />
                  <AccountSecurity />
                </>
              )}
              {tab === "inquiries" && <Inquiries bookings={bookings} onChange={refresh} />}
              {tab === "reviews" && <Reviews reviews={reviews} />}
              {tab === "crm" && <OwnerCrm user={user} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Overview({
  space,
  bookings,
  reviews,
  onGo,
}: {
  space: CoworkingSpaceRow | null;
  bookings: CoworkingBookingRow[];
  reviews: ReviewRow[];
  onGo: (t: Tab) => void;
}) {
  if (!space) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 py-16 text-center">
        <Briefcase className="mx-auto h-10 w-10 text-forest-600" />
        <p className="mt-2 font-display text-lg font-semibold text-forest">List your co-working space</p>
        <p className="mt-1 text-sm text-muted-foreground">Add your details to start receiving bookings.</p>
        <Button variant="gold" className="mt-4 rounded-lg" onClick={() => onGo("profile")}>Create profile</Button>
      </div>
    );
  }
  return (
    <div className="grid gap-5 sm:grid-cols-3">
      <Stat icon={CalendarCheck} label="Requests" value={String(bookings.length)} />
      <Stat icon={Users} label="Pending" value={String(bookings.filter((b) => b.status === "pending").length)} />
      <Stat icon={Star} label="Rating" value={`${Number(space.rating).toFixed(1)} (${reviews.length})`} />
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Star; label: string; value: string }) {
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

function ProfileForm({
  user,
  space,
  onSaved,
}: {
  user: User;
  space: CoworkingSpaceRow | null;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState(space?.name ?? user.name);
  const [ownerName, setOwnerName] = React.useState(space?.owner_name ?? "");
  const [phone, setPhone] = React.useState(space?.phone ?? "");
  const [whatsapp, setWhatsapp] = React.useState(space?.whatsapp ?? "");
  const [email, setEmail] = React.useState(space?.email ?? user.email);
  const [city, setCity] = React.useState(space?.city ?? "");
  const [address, setAddress] = React.useState(space?.address ?? "");
  const [wifi, setWifi] = React.useState(space?.wifi_speed ?? "");
  const [hours, setHours] = React.useState(space?.opening_hours ?? "");
  const [capacity, setCapacity] = React.useState(space?.seating_capacity != null ? String(space.seating_capacity) : "");
  const [hotDesk, setHotDesk] = React.useState(space?.hot_desk_price != null ? String(space.hot_desk_price) : "");
  const [dedicated, setDedicated] = React.useState(space?.dedicated_desk_price != null ? String(space.dedicated_desk_price) : "");
  const [office, setOffice] = React.useState(space?.private_office_price != null ? String(space.private_office_price) : "");
  const [meeting, setMeeting] = React.useState(space?.meeting_room_price != null ? String(space.meeting_room_price) : "");
  const [description, setDescription] = React.useState(space?.description ?? "");
  const [logo, setLogo] = React.useState(space?.logo ?? "");
  const [cover, setCover] = React.useState(space?.cover_image ?? "");
  const [gallery, setGallery] = React.useState<string[]>(space?.gallery ?? []);
  const [amenities, setAmenities] = React.useState<string[]>(space?.amenities ?? []);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState("");

  const toggleAmenity = (a: string) =>
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Space name is required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        owner_name: ownerName.trim() || null,
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        email: email.trim() || null,
        city: city.trim() || null,
        address: address.trim() || null,
        wifi_speed: wifi.trim() || null,
        opening_hours: hours.trim() || null,
        seating_capacity: numOrNull(capacity),
        hot_desk_price: numOrNull(hotDesk),
        dedicated_desk_price: numOrNull(dedicated),
        private_office_price: numOrNull(office),
        meeting_room_price: numOrNull(meeting),
        description: description.trim() || null,
        logo: logo || null,
        cover_image: cover || null,
        gallery,
        amenities,
        owner_email: user.email,
      };
      if (space) {
        const { error: err } = await updateCoworking(space.id, payload);
        if (err) throw err;
      } else {
        const { error: err } = await createCoworking({ ...payload, status: "pending" });
        if (err) throw err;
      }
      setSaved(true);
      onSaved();
    } catch {
      setError("Could not save your space. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-premium sm:p-8">
      <div>
        <h2 className="font-display text-xl font-bold text-forest">
          {space ? "Edit your co-working space" : "List your co-working space"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This powers your public page. New listings go live once an admin approves them.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-forest">Logo</span>
          <AvatarUpload value={logo} onChange={setLogo} />
        </div>
        <div className="flex-1 min-w-[220px]">
          <span className="mb-1.5 block text-sm font-semibold text-forest">Cover image</span>
          <ImageUpload value={cover} onChange={setCover} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Space name" required><input className="auth-input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Owner / manager name"><input className="auth-input" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} /></Field>
        <Field label="Phone"><input className="auth-input" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="WhatsApp"><input className="auth-input" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} /></Field>
        <Field label="Email"><input className="auth-input" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="City"><input className="auth-input" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Gilgit, Skardu…" /></Field>
        <Field label="Address"><input className="auth-input" value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
        <Field label="WiFi speed"><input className="auth-input" value={wifi} onChange={(e) => setWifi(e.target.value)} placeholder="e.g. 30 Mbps fibre" /></Field>
        <Field label="Opening hours"><input className="auth-input" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. 9 AM – 9 PM" /></Field>
        <Field label="Seating capacity"><input type="number" min={0} className="auth-input" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></Field>
      </div>

      <div>
        <h3 className="font-display text-base font-bold text-forest">Pricing (leave blank if not offered)</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Hot desk (per day)"><input type="number" min={0} className="auth-input" value={hotDesk} onChange={(e) => setHotDesk(e.target.value)} /></Field>
          <Field label="Dedicated desk (per month)"><input type="number" min={0} className="auth-input" value={dedicated} onChange={(e) => setDedicated(e.target.value)} /></Field>
          <Field label="Private office (per month)"><input type="number" min={0} className="auth-input" value={office} onChange={(e) => setOffice(e.target.value)} /></Field>
          <Field label="Meeting room (per hour)"><input type="number" min={0} className="auth-input" value={meeting} onChange={(e) => setMeeting(e.target.value)} /></Field>
        </div>
      </div>

      <div>
        <h3 className="font-display text-base font-bold text-forest">Amenities</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {COWORKING_AMENITIES.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => toggleAmenity(a)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                amenities.includes(a)
                  ? "border-forest-300 bg-forest-50 text-forest-600"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <Field label="Description"><textarea rows={4} className="auth-input resize-none" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell remote workers about your space…" /></Field>

      <div>
        <span className="mb-1.5 block text-sm font-semibold text-forest">Gallery images</span>
        <MultiImageUpload value={gallery} onChange={setGallery} />
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" variant="gold" className="rounded-lg" disabled={saving}>
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : space ? "Save changes" : "Create listing"}
        </Button>
        {saved && <span className="flex items-center gap-1 text-sm font-medium text-forest-600"><CheckCircle2 className="h-4 w-4" /> Saved</span>}
      </div>
    </form>
  );
}

function Inquiries({
  bookings,
  onChange,
}: {
  bookings: CoworkingBookingRow[];
  onChange: () => void;
}) {
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const update = async (b: CoworkingBookingRow, status: "accepted" | "rejected" | "completed") => {
    setBusyId(b.id);
    await setCoworkingBookingStatus(b.id, status);
    if (b.customer_email) {
      void sendEmail(
        b.customer_email,
        `Co-working booking ${coworkingBookingRef(b.id)} — ${status}`,
        `<p>Your booking request <strong>${coworkingBookingRef(b.id)}</strong> is now <strong>${status}</strong>.</p>`
      ).catch(() => {});
    }
    await onChange();
    setBusyId(null);
  };

  if (bookings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 py-16 text-center">
        <CalendarCheck className="mx-auto h-10 w-10 text-forest-600" />
        <p className="mt-2 font-display text-lg font-semibold text-forest">No requests yet</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {bookings.map((b) => (
        <div key={b.id} className="rounded-2xl border border-border bg-card p-5 shadow-premium">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display font-bold text-forest">{planName(b.plan_type || "")}</p>
                <StatusBadge status={b.status} />
              </div>
              <p className="mt-0.5 text-xs font-semibold tracking-wider text-forest-600">{coworkingBookingRef(b.id)}</p>
            </div>
            <p className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString()}</p>
          </div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <Detail icon={UserRound} label="Customer" value={b.customer_name || "—"} />
            <Detail icon={Phone} label="Phone" value={b.customer_phone || "—"} />
            <Detail icon={CalendarCheck} label="Start" value={b.start_date || "—"} />
            <Detail icon={Users} label="People" value={String(b.people)} />
          </div>
          {b.duration && <p className="mt-1 text-sm text-muted-foreground">Duration: {b.duration}</p>}
          {b.notes && <p className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">{b.notes}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {b.customer_phone && (
              <a href={`tel:${b.customer_phone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-forest hover:bg-muted">
                <Phone className="h-4 w-4" /> Call
              </a>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
            {b.status === "pending" && (
              <>
                <button disabled={busyId === b.id} onClick={() => update(b, "accepted")} className="rounded-lg bg-forest-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-60">Accept</button>
                <button disabled={busyId === b.id} onClick={() => update(b, "rejected")} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60">Reject</button>
              </>
            )}
            {b.status === "accepted" && (
              <button disabled={busyId === b.id} onClick={() => update(b, "completed")} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">Mark completed</button>
            )}
            {(b.status === "completed" || b.status === "rejected") && (
              <span className="text-sm text-muted-foreground">Request {b.status}.</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Reviews({ reviews }: { reviews: ReviewRow[] }) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 py-16 text-center">
        <Star className="mx-auto h-10 w-10 text-forest-600" />
        <p className="mt-2 font-display text-lg font-semibold text-forest">No reviews yet</p>
        <p className="mt-1 text-sm text-muted-foreground">You can reply to reviews on your public page.</p>
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
          {r.text && <p className="mt-1 text-sm text-muted-foreground">{r.text}</p>}
          {r.owner_reply && (
            <div className="mt-2 rounded-lg border border-forest-100 bg-forest-50/60 p-2.5 text-sm">
              <span className="text-xs font-bold uppercase tracking-wide text-forest-600">Your reply</span>
              <p className="mt-0.5 text-forest/85">{r.owner_reply}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-gold/20 text-gold-700",
    accepted: "bg-forest-50 text-forest-600",
    rejected: "bg-red-50 text-red-600",
    completed: "bg-green-50 text-green-600",
  };
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", map[status] ?? "bg-muted")}>{status}</span>;
}

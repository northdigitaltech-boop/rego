"use client";

import * as React from "react";
import {
  LayoutDashboard,
  Building2,
  PlusCircle,
  UserRound,
  LogOut,
  MapPin,
  Trash2,
  CheckCircle2,
  Eye,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ContactAdminButton } from "@/components/chat/contact-admin-button";
import { AccountSecurity } from "@/components/account/account-security";
import { type User } from "@/components/auth/auth-context";
import {
  categories,
  getCategory,
  locations,
  type CategorySlug,
} from "@/lib/data";
import {
  listFor,
  addListing,
  removeListing,
  type PartnerListing,
} from "@/lib/partner-store";
import { cn, formatPrice } from "@/lib/utils";

type Tab = "overview" | "listings" | "add" | "profile";

const nav: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "listings", label: "My Listings", icon: Building2 },
  { id: "add", label: "Add Listing", icon: PlusCircle },
  { id: "profile", label: "Business Profile", icon: UserRound },
];

const partnerCategories = categories.filter((c) => c.slug !== "more");

export function PartnerDashboard({
  user,
  onSignOut,
}: {
  user: User;
  onSignOut: () => void;
}) {
  const [tab, setTab] = React.useState<Tab>("overview");
  const [items, setItems] = React.useState<PartnerListing[]>([]);

  const refresh = React.useCallback(() => {
    setItems(listFor(user.email));
  }, [user.email]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const categoryName =
    getCategory(user.businessCategory ?? "")?.name ?? "Business";

  const handleDelete = (id: string) => {
    removeListing(user.email, id);
    refresh();
  };

  const handleAdded = () => {
    refresh();
    setTab("listings");
  };

  return (
    <div className="container-px py-10">
      <h1 className="font-display text-3xl font-bold text-forest">
        Welcome, {user.name.split(" ")[0]}
      </h1>
      <p className="mt-1 text-muted-foreground">
        Manage your {categoryName.toLowerCase()} listings and business profile.
      </p>
      <div className="mt-3">
        <ContactAdminButton ownerEmail={user.email} ownerName={user.name} ownerAvatar={user.avatar} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Sidebar */}
        <aside>
          <div className="sticky top-24 rounded-3xl border border-border/70 bg-card p-3 shadow-premium">
            <div className="flex items-center gap-3 border-b border-border p-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-gold text-forest-900">
                <Building2 className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-forest">{user.name}</p>
                <span className="mt-1 inline-block rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold-700">
                  {categoryName} · Partner
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
                      tab === n.id
                        ? "bg-gradient-forest text-white shadow-soft"
                        : "text-forest hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {n.label}
                  </button>
                );
              })}
              <button
                onClick={onSignOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-forest hover:bg-muted"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </nav>
          </div>
        </aside>

        {/* Content */}
        <div>
          {tab === "overview" && (
            <Overview
              items={items}
              categoryName={categoryName}
              onAdd={() => setTab("add")}
            />
          )}
          {tab === "listings" && (
            <MyListings items={items} onDelete={handleDelete} onAdd={() => setTab("add")} />
          )}
          {tab === "add" && (
            <AddListing
              ownerEmail={user.email}
              defaultCategory={user.businessCategory}
              onAdded={handleAdded}
            />
          )}
          {tab === "profile" && <BusinessProfile user={user} categoryName={categoryName} />}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Overview ---------------- */

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
}) {
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

function Overview({
  items,
  categoryName,
  onAdd,
}: {
  items: PartnerListing[];
  categoryName: string;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard icon={Building2} label="Active listings" value={String(items.length)} />
        <StatCard icon={Eye} label="Profile views" value={String(items.length * 124)} />
        <StatCard icon={LayoutDashboard} label="Category" value={categoryName} />
      </div>
      <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-premium">
        {items.length === 0 ? (
          <>
            <PlusCircle className="mx-auto h-10 w-10 text-forest-600" />
            <h2 className="mt-3 font-display text-lg font-bold text-forest">
              List your business
            </h2>
            <p className="mt-1 text-muted-foreground">
              Add your {categoryName.toLowerCase()} details so travelers can find
              and book you.
            </p>
            <Button variant="gold" className="mt-5 rounded-lg" onClick={onAdd}>
              Add your first listing
            </Button>
          </>
        ) : (
          <>
            <h2 className="font-display text-lg font-bold text-forest">
              You have {items.length} active{" "}
              {items.length === 1 ? "listing" : "listings"}
            </h2>
            <p className="mt-1 text-muted-foreground">
              Keep your details up to date to attract more bookings.
            </p>
            <Button variant="gold" className="mt-5 rounded-lg" onClick={onAdd}>
              Add another listing
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- My Listings ---------------- */

function MyListings({
  items,
  onDelete,
  onAdd,
}: {
  items: PartnerListing[];
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 py-16 text-center">
        <p className="font-display text-lg font-semibold text-forest">
          No listings yet
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add your company details to get started.
        </p>
        <Button variant="gold" className="mt-5 rounded-lg" onClick={onAdd}>
          Add listing
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((l) => (
        <div
          key={l.id}
          className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-premium sm:flex-row"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={l.image}
            alt={l.title}
            className="h-32 w-full shrink-0 rounded-xl object-cover sm:h-24 sm:w-32"
          />
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-lg font-semibold text-forest">
                {l.title}
              </h3>
              <span className="rounded-full bg-forest-50 px-2.5 py-0.5 text-[10px] font-semibold text-forest-600">
                Published
              </span>
            </div>
            <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {l.location} ·{" "}
              {getCategory(l.category)?.name}
            </p>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {l.description}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <p className="font-display font-bold text-forest">
                {formatPrice(l.price)}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  / {l.unit}
                </span>
              </p>
              <button
                onClick={() => onDelete(l.id)}
                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Add Listing ---------------- */

function AddListing({
  ownerEmail,
  defaultCategory,
  onAdded,
}: {
  ownerEmail: string;
  defaultCategory?: CategorySlug;
  onAdded: () => void;
}) {
  const [category, setCategory] = React.useState<CategorySlug>(
    defaultCategory ?? "hotels"
  );
  const [title, setTitle] = React.useState("");
  const [location, setLocation] = React.useState<string>(locations[0]);
  const [price, setPrice] = React.useState("");
  const [unit, setUnit] = React.useState("night");
  const [description, setDescription] = React.useState("");
  const [image, setImage] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [error, setError] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const priceNum = Number(price);
    if (!title.trim() || !priceNum) {
      setError("Please add at least a title and a valid price.");
      return;
    }
    addListing({
      ownerEmail,
      title: title.trim(),
      category,
      location,
      price: priceNum,
      unit: unit.trim() || "night",
      description: description.trim(),
      image:
        image.trim() ||
        `https://picsum.photos/seed/${category}-${
          Math.floor(Math.random() * 90) + 70
        }/900/600`,
      phone: phone.trim() || undefined,
    });
    onAdded();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-premium sm:p-8"
    >
      <h2 className="font-display text-xl font-bold text-forest">
        Add a new listing
      </h2>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Listing title" required>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Shangrila Resort Skardu"
            className="auth-input"
          />
        </Field>
        <Field label="Category" required>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CategorySlug)}
            className="auth-input"
          >
            {partnerCategories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Location" required>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="auth-input"
          >
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Price (PKR)" required>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="25000"
            className="auth-input"
          />
        </Field>
        <Field label="Per (unit)">
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="night / day / person"
            className="auth-input"
          />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your service, facilities and what makes it special…"
          className="auth-input resize-none"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Image URL (optional)">
          <input
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://…  (leave blank for a default)"
            className="auth-input"
          />
        </Field>
        <Field label="Phone / WhatsApp">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+92 3xx xxxxxxx"
            className="auth-input"
          />
        </Field>
      </div>

      <Button type="submit" variant="gold" size="lg" className="w-full rounded-lg">
        Publish listing
      </Button>
    </form>
  );
}

/* ---------------- Business Profile ---------------- */

function BusinessProfile({
  user,
  categoryName,
}: {
  user: User;
  categoryName: string;
}) {
  const [saved, setSaved] = React.useState(false);
  return (
    <>
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(true);
      }}
      className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-premium sm:p-8"
    >
      <h2 className="font-display text-xl font-bold text-forest">
        Business profile
      </h2>
      {saved && (
        <div className="flex items-center gap-2 rounded-lg border border-forest-200 bg-forest-50 px-4 py-2.5 text-sm font-medium text-forest-600">
          <CheckCircle2 className="h-4 w-4" /> Profile saved (demo)
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name">
          <input className="auth-input" defaultValue={user.name} />
        </Field>
        <Field label="Category">
          <input className="auth-input" defaultValue={categoryName} readOnly />
        </Field>
        <Field label="Email">
          <input className="auth-input" defaultValue={user.email} />
        </Field>
        <Field label="Phone">
          <input className="auth-input" placeholder="+92 300 1234567" />
        </Field>
      </div>
      <Field label="About your business">
        <textarea rows={4} className="auth-input resize-none" placeholder="Tell travelers about your business…" />
      </Field>
      <Button type="submit" variant="gold" className="rounded-lg">
        Save changes
      </Button>
    </form>
    <AccountSecurity />
    </>
  );
}

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

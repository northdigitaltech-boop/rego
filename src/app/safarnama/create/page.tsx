"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, PenLine, Lock, Plus, Trash2, Star, CheckCircle2, BookOpenText } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { useAuth } from "@/components/auth/auth-context";
import { ImageUpload, MultiImageUpload } from "@/components/ui/image-upload";
import {
  createStory,
  readingTime,
  makePreview,
  TRAVEL_TYPES,
  STORY_CITIES,
  type StoryTimelineItem,
  type StoryBudgetItem,
} from "@/lib/safarnama";
import { sendEmail } from "@/lib/email";
import { cn } from "@/lib/utils";

const ADMIN_EMAIL = "northdigitaltech@gmail.com";
const csv = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

export default function CreateStoryPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [title, setTitle] = React.useState("");
  const [destination, setDestination] = React.useState("");
  const [city, setCity] = React.useState<string>("");
  const [tripDate, setTripDate] = React.useState("");
  const [duration, setDuration] = React.useState("");
  const [travelType, setTravelType] = React.useState<string>(TRAVEL_TYPES[0].slug);
  const [budget, setBudget] = React.useState("");
  const [transportation, setTransportation] = React.useState("");
  const [hotels, setHotels] = React.useState("");
  const [places, setPlaces] = React.useState("");
  const [restaurants, setRestaurants] = React.useState("");
  const [best, setBest] = React.useState("");
  const [problems, setProblems] = React.useState("");
  const [tips, setTips] = React.useState("");
  const [road, setRoad] = React.useState("");
  const [food, setFood] = React.useState("");
  const [story, setStory] = React.useState("");
  const [cover, setCover] = React.useState("");
  const [gallery, setGallery] = React.useState<string[]>([]);
  const [videos, setVideos] = React.useState("");
  const [rating, setRating] = React.useState(5);
  const [timeline, setTimeline] = React.useState<StoryTimelineItem[]>([]);
  const [budgetRows, setBudgetRows] = React.useState<StoryBudgetItem[]>([]);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!user) return;
    if (!title.trim() || !story.trim()) {
      setError("Please add a title and your story.");
      return;
    }
    setBusy(true);
    const payload = {
      owner_email: user.email,
      author_name: user.name,
      author_avatar: user.avatar ?? null,
      title: title.trim(),
      cover_image: cover || (gallery[0] ?? null),
      destination: destination.trim() || null,
      city: city || null,
      trip_date: tripDate || null,
      duration: duration.trim() || null,
      travel_type: travelType,
      budget: budget.trim() || null,
      transportation: transportation.trim() || null,
      hotels: hotels.trim() ? csv(hotels) : null,
      places_visited: places.trim() ? csv(places) : null,
      restaurants: restaurants.trim() ? csv(restaurants) : null,
      best_experience: best.trim() || null,
      problems_faced: problems.trim() || null,
      travel_tips: tips.trim() || null,
      road_condition: road.trim() || null,
      food_recommendations: food.trim() || null,
      story: story.trim(),
      preview: makePreview(story),
      gallery: gallery.length ? gallery : null,
      videos: videos.trim() ? videos.split(/\n+/).map((v) => v.trim()).filter(Boolean) : null,
      timeline: timeline.filter((t) => t.title.trim()).length ? timeline.filter((t) => t.title.trim()) : null,
      budget_breakdown: budgetRows.filter((b) => b.label.trim()).length ? budgetRows.filter((b) => b.label.trim()) : null,
      rating,
      reading_time: readingTime(story),
    };
    try {
      const { error: dbErr } = await createStory(payload);
      if (dbErr) throw dbErr;
      void sendEmail(
        ADMIN_EMAIL,
        `New Safarnama story pending approval — ${title.trim()}`,
        `<p>A new traveller story was submitted and is awaiting approval.</p>` +
          `<p><strong>Title:</strong> ${title.trim()}<br/><strong>By:</strong> ${user.name} (${user.email})` +
          (destination ? `<br/><strong>Destination:</strong> ${destination}` : "") +
          `</p><p>Review it in Admin → Safarnama.</p>`
      ).catch(() => {});
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Could not publish your story. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <>
        <Navbar />
        <main className="grid min-h-[70vh] place-items-center px-6">
          <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-premium">
            <Lock className="mx-auto h-10 w-10 text-forest-600" />
            <h1 className="mt-3 font-display text-xl font-bold text-forest">Sign in to share your story</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tell fellow travellers about your Gilgit-Baltistan journey.
            </p>
            <Link href="/signin?redirect=/safarnama/create" className="mt-5 inline-flex rounded-xl bg-gradient-forest px-6 py-3 text-sm font-semibold text-white">
              Sign in
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (done) {
    return (
      <>
        <Navbar />
        <main className="grid min-h-[70vh] place-items-center px-6">
          <div className="max-w-lg rounded-3xl border border-border/70 bg-card p-8 text-center shadow-premium-lg">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-forest-50">
              <CheckCircle2 className="h-9 w-9 text-forest-600" />
            </span>
            <h1 className="mt-4 font-display text-2xl font-bold text-forest">Your story has been submitted</h1>
            <div className="mx-auto mt-3 w-fit rounded-full bg-gold/15 px-4 py-2 text-sm font-semibold text-gold-700">
              Pending review
            </div>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              Thank you for sharing! Our team reviews every Safarnama before it goes public. It&apos;ll
              appear once approved.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/safarnama" className="inline-flex items-center gap-2 rounded-xl bg-gradient-forest px-5 py-3 text-sm font-semibold text-white">
                <BookOpenText className="h-4 w-4" /> Browse stories
              </Link>
              <button onClick={() => router.refresh()} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-forest hover:bg-muted">
                Write another
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-muted/30 pb-16">
        <div className="bg-gradient-forest text-white">
          <div className="container-px py-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              <PenLine className="h-4 w-4 text-gold" /> Safarnama
            </span>
            <h1 className="mt-3 font-display text-2xl font-bold sm:text-3xl">Share your travel story</h1>
            <p className="mt-1 text-sm text-white/85">Your real experience helps fellow travellers plan better trips.</p>
          </div>
        </div>

        <form onSubmit={submit} className="container-px mt-8 space-y-6">
          {/* Basics */}
          <Card title="Story basics">
            <Field label="Story title" required>
              <input className="auth-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 7 unforgettable days in Hunza" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Destination">
                <input className="auth-input" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. Hunza Valley" />
              </Field>
              <Field label="City">
                <select className="auth-input" value={city} onChange={(e) => setCity(e.target.value)}>
                  <option value="">Select…</option>
                  {STORY_CITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Trip date">
                <input type="date" className="auth-input" value={tripDate} onChange={(e) => setTripDate(e.target.value)} />
              </Field>
              <Field label="Travel duration">
                <input className="auth-input" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 7 days" />
              </Field>
              <Field label="Travel type">
                <select className="auth-input" value={travelType} onChange={(e) => setTravelType(e.target.value)}>
                  {TRAVEL_TYPES.map((t) => <option key={t.slug} value={t.slug}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Budget">
                <input className="auth-input" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. PKR 55,000" />
              </Field>
              <Field label="Transportation used">
                <input className="auth-input" value={transportation} onChange={(e) => setTransportation(e.target.value)} placeholder="e.g. Rented jeep" />
              </Field>
              <Field label="Rating of trip">
                <StarPicker value={rating} onChange={setRating} />
              </Field>
            </div>
          </Card>

          {/* The story */}
          <Card title="Your story">
            <Field label="Full travel story" required>
              <textarea rows={8} className="auth-input resize-none" value={story} onChange={(e) => setStory(e.target.value)} placeholder="Tell your journey — what happened, how it felt, what you saw…" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Best experience">
                <textarea rows={2} className="auth-input resize-none" value={best} onChange={(e) => setBest(e.target.value)} />
              </Field>
              <Field label="Problems faced">
                <textarea rows={2} className="auth-input resize-none" value={problems} onChange={(e) => setProblems(e.target.value)} />
              </Field>
              <Field label="Travel tips">
                <textarea rows={2} className="auth-input resize-none" value={tips} onChange={(e) => setTips(e.target.value)} />
              </Field>
              <Field label="Road condition experience">
                <textarea rows={2} className="auth-input resize-none" value={road} onChange={(e) => setRoad(e.target.value)} />
              </Field>
              <Field label="Food recommendations">
                <textarea rows={2} className="auth-input resize-none" value={food} onChange={(e) => setFood(e.target.value)} />
              </Field>
            </div>
          </Card>

          {/* Details */}
          <Card title="Trip details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Hotels stayed (comma separated)">
                <input className="auth-input" value={hotels} onChange={(e) => setHotels(e.target.value)} placeholder="Hotel A, Guest House B" />
              </Field>
              <Field label="Places visited (comma separated)">
                <input className="auth-input" value={places} onChange={(e) => setPlaces(e.target.value)} placeholder="Attabad Lake, Baltit Fort" />
              </Field>
              <Field label="Restaurants (comma separated)">
                <input className="auth-input" value={restaurants} onChange={(e) => setRestaurants(e.target.value)} placeholder="Cafe X, Restaurant Y" />
              </Field>
            </div>

            {/* Timeline builder */}
            <RowBuilder
              label="Trip timeline"
              addLabel="Add day / stop"
              rows={timeline}
              onAdd={() => setTimeline((r) => [...r, { title: "", date: "", note: "" }])}
              onRemove={(i) => setTimeline((r) => r.filter((_, x) => x !== i))}
              render={(row, i) => (
                <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_130px]">
                  <input className="auth-input" placeholder="Title (e.g. Day 1 — Gilgit)" value={row.title} onChange={(e) => setTimeline((r) => r.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))} />
                  <input className="auth-input" placeholder="Date" value={row.date} onChange={(e) => setTimeline((r) => r.map((x, idx) => idx === i ? { ...x, date: e.target.value } : x))} />
                  <input className="auth-input sm:col-span-2" placeholder="Note" value={row.note} onChange={(e) => setTimeline((r) => r.map((x, idx) => idx === i ? { ...x, note: e.target.value } : x))} />
                </div>
              )}
            />

            {/* Budget breakdown builder */}
            <RowBuilder
              label="Budget breakdown"
              addLabel="Add line item"
              rows={budgetRows}
              onAdd={() => setBudgetRows((r) => [...r, { label: "", amount: "" }])}
              onRemove={(i) => setBudgetRows((r) => r.filter((_, x) => x !== i))}
              render={(row, i) => (
                <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_140px]">
                  <input className="auth-input" placeholder="Item (e.g. Transport)" value={row.label} onChange={(e) => setBudgetRows((r) => r.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} />
                  <input className="auth-input" placeholder="Amount (e.g. PKR 12,000)" value={row.amount} onChange={(e) => setBudgetRows((r) => r.map((x, idx) => idx === i ? { ...x, amount: e.target.value } : x))} />
                </div>
              )}
            />
          </Card>

          {/* Media */}
          <Card title="Photos & video">
            <Field label="Cover photo">
              <ImageUpload value={cover} onChange={setCover} />
            </Field>
            <Field label="Photo gallery">
              <MultiImageUpload value={gallery} onChange={setGallery} />
            </Field>
            <Field label="Video links (one per line)">
              <textarea rows={2} className="auth-input resize-none" value={videos} onChange={(e) => setVideos(e.target.value)} placeholder="https://…mp4 or embed URL" />
            </Field>
          </Card>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-gradient-gold px-6 py-3 text-sm font-semibold text-forest-900 shadow-soft disabled:opacity-50">
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Publishing…</> : <><PenLine className="h-4 w-4" /> Publish story</>}
            </button>
            <Link href="/safarnama" className="inline-flex items-center rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-forest hover:bg-muted">
              Cancel
            </Link>
          </div>
        </form>
      </main>
      <Footer />
    </>
  );
}

/* ---------------- helpers ---------------- */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-3xl border border-border/70 bg-card p-6 shadow-premium">
      <h2 className="font-display text-lg font-bold text-forest">{title}</h2>
      {children}
    </section>
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

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} stars`}>
          <Star className={cn("h-6 w-6", n <= value ? "fill-gold text-gold" : "text-muted-foreground")} />
        </button>
      ))}
    </div>
  );
}

function RowBuilder<T>({
  label,
  addLabel,
  rows,
  onAdd,
  onRemove,
  render,
}: {
  label: string;
  addLabel: string;
  rows: T[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  render: (row: T, i: number) => React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-forest">{label}</span>
        <button type="button" onClick={onAdd} className="inline-flex items-center gap-1 text-sm font-semibold text-forest-600 hover:text-gold">
          <Plus className="h-4 w-4" /> {addLabel}
        </button>
      </div>
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">None added yet.</p>
        ) : (
          rows.map((row, i) => (
            <div key={i} className="flex items-start gap-2">
              {render(row, i)}
              <button type="button" onClick={() => onRemove(i)} className="mt-2 shrink-0 text-red-500 hover:text-red-600" aria-label="Remove">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

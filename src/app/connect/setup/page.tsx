"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Save, Compass, Lock, CheckCircle2, Clock, Users } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { useAuth } from "@/components/auth/auth-context";
import { AvatarUpload, ImageUpload, MultiImageUpload } from "@/components/ui/image-upload";
import {
  getSoloByOwner,
  createSolo,
  updateSolo,
  LOOKING_FOR,
  TRAVEL_PREFERENCES,
  TRANSPORT_TYPES,
  ACCOMMODATION_PREFS,
  GB_DESTINATIONS,
  type SoloTravelerRow,
} from "@/lib/solo";
import { sendEmail } from "@/lib/email";
import { cn } from "@/lib/utils";

const ADMIN_EMAIL = "northdigitaltech@gmail.com";

const LANGUAGE_OPTIONS = ["English", "Urdu", "Balti", "Shina", "Wakhi", "Burushaski", "Punjabi", "Pashto"];

export default function SoloSetupPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [existing, setExisting] = React.useState<SoloTravelerRow | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [saved, setSaved] = React.useState<{ id: string; approved: boolean } | null>(null);

  // Fields
  const [fullName, setFullName] = React.useState("");
  const [age, setAge] = React.useState("");
  const [gender, setGender] = React.useState("");
  const [nationality, setNationality] = React.useState("");
  const [currentCity, setCurrentCity] = React.useState("");
  const [profilePhoto, setProfilePhoto] = React.useState("");
  const [coverImage, setCoverImage] = React.useState("");
  const [intro, setIntro] = React.useState("");
  const [whyVisiting, setWhyVisiting] = React.useState("");
  const [experience, setExperience] = React.useState("");
  const [occupation, setOccupation] = React.useState("");
  const [languages, setLanguages] = React.useState<string[]>([]);
  const [interests, setInterests] = React.useState("");
  const [destinations, setDestinations] = React.useState<string[]>([]);
  const [departure, setDeparture] = React.useState("");
  const [returnDate, setReturnDate] = React.useState("");
  const [duration, setDuration] = React.useState("");
  const [budget, setBudget] = React.useState("");
  const [transport, setTransport] = React.useState("");
  const [accommodation, setAccommodation] = React.useState("");
  const [seats, setSeats] = React.useState("");
  const [lookingFor, setLookingFor] = React.useState<string[]>([]);
  const [genderPref, setGenderPref] = React.useState("");
  const [agePref, setAgePref] = React.useState("");
  const [preferences, setPreferences] = React.useState<string[]>([]);
  const [gallery, setGallery] = React.useState<string[]>([]);
  const [phone, setPhone] = React.useState("");
  const [whatsapp, setWhatsapp] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    if (!user) {
      setLoading(false);
      return;
    }
    getSoloByOwner(user.email).then((p) => {
      if (!alive) return;
      if (p) {
        setExisting(p);
        setFullName(p.full_name ?? "");
        setAge(p.age?.toString() ?? "");
        setGender(p.gender ?? "");
        setNationality(p.nationality ?? "");
        setCurrentCity(p.current_city ?? "");
        setProfilePhoto(p.profile_photo ?? "");
        setCoverImage(p.cover_image ?? "");
        setIntro(p.intro ?? "");
        setWhyVisiting(p.why_visiting ?? "");
        setExperience(p.travel_experience ?? "");
        setOccupation(p.occupation ?? "");
        setLanguages(p.languages ?? []);
        setInterests((p.interests ?? []).join(", "));
        setDestinations(p.destinations ?? []);
        setDeparture(p.departure_date ?? "");
        setReturnDate(p.return_date ?? "");
        setDuration(p.duration ?? "");
        setBudget(p.budget ?? "");
        setTransport(p.transportation_type ?? "");
        setAccommodation(p.accommodation_preference ?? "");
        setSeats(p.available_seats?.toString() ?? "");
        setLookingFor(p.looking_for ?? []);
        setGenderPref(p.gender_preference ?? "");
        setAgePref(p.age_preference ?? "");
        setPreferences(p.travel_preferences ?? []);
        setGallery(p.gallery ?? []);
        setPhone(p.phone ?? "");
        setWhatsapp(p.whatsapp ?? "");
      } else {
        setFullName(user.name ?? "");
        setProfilePhoto(user.avatar ?? "");
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [user]);

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) => {
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!user) return;
    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    setBusy(true);
    const payload = {
      owner_email: user.email,
      full_name: fullName.trim(),
      age: age ? Number(age) : null,
      gender: gender || null,
      nationality: nationality.trim() || null,
      current_city: currentCity.trim() || null,
      profile_photo: profilePhoto || null,
      cover_image: coverImage || null,
      intro: intro.trim() || null,
      why_visiting: whyVisiting.trim() || null,
      travel_experience: experience.trim() || null,
      occupation: occupation.trim() || null,
      languages: languages.length ? languages : null,
      interests: interests.trim()
        ? interests.split(",").map((s) => s.trim()).filter(Boolean)
        : null,
      destinations: destinations.length ? destinations : null,
      departure_date: departure || null,
      return_date: returnDate || null,
      duration: duration.trim() || null,
      budget: budget.trim() || null,
      transportation_type: transport || null,
      accommodation_preference: accommodation || null,
      available_seats: seats ? Number(seats) : null,
      looking_for: lookingFor.length ? lookingFor : null,
      gender_preference: genderPref || null,
      age_preference: agePref.trim() || null,
      travel_preferences: preferences.length ? preferences : null,
      gallery: gallery.length ? gallery : null,
      phone: phone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      email: user.email,
      email_verified: true, // signed-in email is verified
      last_active: new Date().toISOString(),
    };

    try {
      if (existing) {
        const { error: e1 } = await updateSolo(existing.id, payload);
        if (e1) throw e1;
        // Already-approved profiles stay live; go straight to the public page.
        if (existing.status === "approved") {
          router.push(`/connect/${existing.id}`);
          return;
        }
        setSaved({ id: existing.id, approved: false });
      } else {
        const { data, error: e2 } = await createSolo(payload);
        if (e2) throw e2;
        setSaved({ id: data?.id ?? "", approved: false });
        // Notify admin so they can review & approve the new profile.
        void sendEmail(
          ADMIN_EMAIL,
          `New solo traveller profile pending approval — ${fullName.trim()}`,
          `<p>A new <strong>Connect Solo Traveler</strong> profile was submitted and is awaiting approval.</p>` +
            `<p><strong>Name:</strong> ${fullName.trim()}<br/>` +
            `<strong>Email:</strong> ${user.email}<br/>` +
            (currentCity ? `<strong>City:</strong> ${currentCity}<br/>` : "") +
            (destinations.length ? `<strong>Destinations:</strong> ${destinations.join(", ")}<br/>` : "") +
            `</p><p>Review it in Admin → Connect Solo Traveler.</p>`
        ).catch(() => {});
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Could not save your profile. Please try again.");
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
            <h1 className="mt-3 font-display text-xl font-bold text-forest">Sign in to continue</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your traveller profile to connect with companions across Gilgit-Baltistan.
            </p>
            <Link
              href="/signin?redirect=/connect/setup"
              className="mt-5 inline-flex rounded-xl bg-gradient-forest px-6 py-3 text-sm font-semibold text-white"
            >
              Sign in
            </Link>
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
              <Compass className="h-4 w-4 text-gold" /> Connect Solo Traveler
            </span>
            <h1 className="mt-3 font-display text-2xl font-bold sm:text-3xl">
              {existing ? "Edit your traveller profile" : "Create your traveller profile"}
            </h1>
            <p className="mt-1 text-sm text-white/85">
              Share your trip so companions heading the same way can find you.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-forest-600" />
          </div>
        ) : saved ? (
          <div className="container-px mt-8">
            <div className="mx-auto max-w-lg rounded-3xl border border-border/70 bg-card p-8 text-center shadow-premium-lg">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-forest-50">
                <CheckCircle2 className="h-9 w-9 text-forest-600" />
              </span>
              <h2 className="mt-4 font-display text-2xl font-bold text-forest">
                {existing ? "Your profile has been updated" : "Your profile has been created"}
              </h2>
              <div className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-full bg-gold/15 px-4 py-2 text-sm font-semibold text-gold-700">
                <Clock className="h-4 w-4" /> It will be approved soon
              </div>
              <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
                Thanks! Our team reviews every traveller profile before it goes public
                (usually within a day). Once approved, you&apos;ll appear in{" "}
                <strong>Connect Solo Traveler</strong> for others to find. You can keep editing anytime.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => setSaved(null)}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-forest px-5 py-3 text-sm font-semibold text-white shadow-soft hover:opacity-95"
                >
                  <Save className="h-4 w-4" /> Keep editing
                </button>
                <Link
                  href="/connect/requests"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-forest hover:bg-muted"
                >
                  <Users className="h-4 w-4" /> My connections
                </Link>
                <Link
                  href="/connect"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-forest hover:bg-muted"
                >
                  Browse travellers
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="container-px mt-8 space-y-6">
            {/* Photos */}
            <Card title="Photos">
              <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
                <div>
                  <Label>Profile picture</Label>
                  <AvatarUpload value={profilePhoto} onChange={setProfilePhoto} />
                </div>
                <div>
                  <Label>Cover photo (destination)</Label>
                  <ImageUpload value={coverImage} onChange={setCoverImage} />
                </div>
              </div>
            </Card>

            {/* Identity */}
            <Card title="About you">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" required>
                  <input className="auth-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </Field>
                <Field label="Age">
                  <input type="number" min={16} max={100} className="auth-input" value={age} onChange={(e) => setAge(e.target.value)} />
                </Field>
                <Field label="Gender">
                  <select className="auth-input" value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="">Prefer not to say</option>
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </Field>
                <Field label="Nationality">
                  <input className="auth-input" value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="e.g. Pakistani" />
                </Field>
                <Field label="Current city">
                  <input className="auth-input" value={currentCity} onChange={(e) => setCurrentCity(e.target.value)} placeholder="e.g. Islamabad" />
                </Field>
                <Field label="Occupation">
                  <input className="auth-input" value={occupation} onChange={(e) => setOccupation(e.target.value)} placeholder="e.g. Software engineer" />
                </Field>
              </div>
              <Field label="Short introduction">
                <textarea rows={3} className="auth-input resize-none" value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="Tell other travellers a bit about you…" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Why I'm visiting Gilgit-Baltistan">
                  <textarea rows={2} className="auth-input resize-none" value={whyVisiting} onChange={(e) => setWhyVisiting(e.target.value)} />
                </Field>
                <Field label="Travel experience">
                  <textarea rows={2} className="auth-input resize-none" value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="e.g. 12 countries, 3 GB trips" />
                </Field>
              </div>
              <Field label="Languages spoken">
                <ChipGroup options={LANGUAGE_OPTIONS} selected={languages} onToggle={(v) => toggle(languages, setLanguages, v)} />
              </Field>
              <Field label="Interests (comma separated)">
                <input className="auth-input" value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="Photography, coffee, history…" />
              </Field>
            </Card>

            {/* Travel plan */}
            <Card title="Current travel plan">
              <Field label="Destination(s)">
                <ChipGroup options={[...GB_DESTINATIONS]} selected={destinations} onToggle={(v) => toggle(destinations, setDestinations, v)} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Departure date">
                  <input type="date" className="auth-input" value={departure} onChange={(e) => setDeparture(e.target.value)} />
                </Field>
                <Field label="Return date">
                  <input type="date" className="auth-input" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
                </Field>
                <Field label="Duration">
                  <input className="auth-input" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 7 days" />
                </Field>
                <Field label="Budget">
                  <input className="auth-input" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g. PKR 40,000 – 60,000" />
                </Field>
                <Field label="Transportation type">
                  <select className="auth-input" value={transport} onChange={(e) => setTransport(e.target.value)}>
                    <option value="">Select…</option>
                    {TRANSPORT_TYPES.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </Field>
                <Field label="Accommodation preference">
                  <select className="auth-input" value={accommodation} onChange={(e) => setAccommodation(e.target.value)}>
                    <option value="">Select…</option>
                    {ACCOMMODATION_PREFS.map((x) => <option key={x}>{x}</option>)}
                  </select>
                </Field>
                <Field label="Available seats">
                  <input type="number" min={0} max={20} className="auth-input" value={seats} onChange={(e) => setSeats(e.target.value)} />
                </Field>
                <Field label="Gender preference (optional)">
                  <select className="auth-input" value={genderPref} onChange={(e) => setGenderPref(e.target.value)}>
                    <option value="">No preference</option>
                    <option>Any</option>
                    <option>Male</option>
                    <option>Female</option>
                  </select>
                </Field>
                <Field label="Age preference (optional)">
                  <input className="auth-input" value={agePref} onChange={(e) => setAgePref(e.target.value)} placeholder="e.g. 25–40" />
                </Field>
              </div>
              <Field label="Looking for">
                <ChipGroup options={[...LOOKING_FOR]} selected={lookingFor} onToggle={(v) => toggle(lookingFor, setLookingFor, v)} />
              </Field>
            </Card>

            {/* Preferences */}
            <Card title="Travel preferences">
              <ChipGroup options={[...TRAVEL_PREFERENCES]} selected={preferences} onToggle={(v) => toggle(preferences, setPreferences, v)} />
            </Card>

            {/* Gallery */}
            <Card title="Travel gallery">
              <Label>Photos &amp; drone shots</Label>
              <MultiImageUpload value={gallery} onChange={setGallery} />
            </Card>

            {/* Contact */}
            <Card title="Contact">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Phone">
                  <input className="auth-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 3xx xxxxxxx" />
                </Field>
                <Field label="WhatsApp">
                  <input className="auth-input" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+92 3xx xxxxxxx" />
                </Field>
              </div>
              <p className="text-xs text-muted-foreground">
                Your profile is reviewed before it appears publicly. Verification badges (ID, phone,
                face, emergency contact) are added by our team.
              </p>
            </Card>

            {error && <p className="text-sm font-medium text-red-600">{error}</p>}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-gold px-6 py-3 text-sm font-semibold text-forest-900 shadow-soft disabled:opacity-50"
              >
                {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> {existing ? "Save changes" : "Create profile"}</>}
              </button>
              <Link href="/connect" className="inline-flex items-center rounded-xl border border-border bg-card px-6 py-3 text-sm font-semibold text-forest hover:bg-muted">
                Cancel
              </Link>
            </div>
          </form>
        )}
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

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-sm font-semibold text-forest">{children}</span>;
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

function ChipGroup({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              on
                ? "border-forest-600 bg-forest-600 text-white"
                : "border-border bg-card text-forest hover:border-gold/60"
            )}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

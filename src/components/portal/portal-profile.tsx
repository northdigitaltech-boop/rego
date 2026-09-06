"use client";

import * as React from "react";
import { Loader2, Plus, Trash2, Lock } from "lucide-react";

import { ImageUpload } from "@/components/ui/image-upload";
import { useAuth } from "@/components/auth/auth-context";
import { type StaffProfile } from "@/lib/staff-portal";
import {
  GENDERS,
  LANGUAGE_LEVELS,
  getMyCv,
  saveAvatar,
  saveMyCv,
  type Education,
  type Experience,
  type Language,
  type StaffCv,
} from "@/lib/staff-profile";

/* ============================================================
 * Profile and CV.
 *
 * Only the person themselves and an admin can read any of this —
 * phase109 has two policies and no third. So the screen can say so
 * plainly, which matters: somebody is being asked for a date of
 * birth and a home address, and "who else sees this" is a fair
 * question to answer before they type.
 *
 * Employee code, department, role and status are shown but not
 * editable. They are set by an admin, attribution points at the
 * code, and a field that looks editable and is refused teaches
 * nothing except distrust.
 * ============================================================ */

export function PortalProfile({ profile }: { profile: StaffProfile }) {
  const { user, updateProfile } = useAuth();

  const [cv, setCv] = React.useState<StaffCv | null | undefined>(undefined);
  const [avatar, setAvatar] = React.useState(user?.avatar ?? "");
  const [busy, setBusy] = React.useState(false);
  const [note, setNote] = React.useState<{ ok: boolean; text: string } | null>(null);

  /* Editable copies. Kept in one object so "save" is one write rather than a
     field-by-field trickle that leaves a half-saved CV if the tab closes. */
  const [form, setForm] = React.useState({
    headline: "",
    bio: "",
    date_of_birth: "",
    gender: "",
    personal_email: "",
    address: "",
    city: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relation: "",
  });
  const [education, setEducation] = React.useState<Education[]>([]);
  const [experience, setExperience] = React.useState<Experience[]>([]);
  const [skills, setSkills] = React.useState<string[]>([]);
  const [languages, setLanguages] = React.useState<Language[]>([]);

  React.useEffect(() => {
    let alive = true;
    getMyCv(profile.staff_id).then((row) => {
      if (!alive) return;
      setCv(row);
      if (!row) return;
      setForm({
        headline: row.headline ?? "",
        bio: row.bio ?? "",
        date_of_birth: row.date_of_birth ?? "",
        gender: row.gender ?? "",
        personal_email: row.personal_email ?? "",
        address: row.address ?? "",
        city: row.city ?? "",
        emergency_contact_name: row.emergency_contact_name ?? "",
        emergency_contact_phone: row.emergency_contact_phone ?? "",
        emergency_contact_relation: row.emergency_contact_relation ?? "",
      });
      setEducation(row.education);
      setExperience(row.experience);
      setSkills(row.skills);
      setLanguages(row.languages);
    });
    return () => {
      alive = false;
    };
  }, [profile.staff_id]);

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onAvatar = async (url: string) => {
    setAvatar(url);
    const res = await saveAvatar(url);
    if (!res.ok) {
      setNote({ ok: false, text: res.error ?? "Could not save the picture." });
      return;
    }
    /* Keep the session's copy in step so the sidebar and navbar change now
       rather than after a reload. */
    try {
      await updateProfile({ avatar: url });
    } catch {
      /* The picture is saved; a stale header is not worth an error. */
    }
    setNote({ ok: true, text: "Picture updated." });
  };

  const save = async () => {
    setBusy(true);
    setNote(null);
    const res = await saveMyCv(profile.staff_id, {
      ...form,
      education,
      experience,
      skills: skills.filter((s) => s.trim()),
      languages: languages.filter((l) => l.name.trim()),
    });
    setBusy(false);
    setNote(
      res.ok
        ? { ok: true, text: "Saved." }
        : { ok: false, text: res.error ?? "Could not save." }
    );
  };

  if (cv === undefined) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {note && (
        <p
          className={
            note.ok
              ? "rounded-xl border border-forest-200 bg-forest-50 px-4 py-3 text-sm text-forest-700"
              : "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          }
        >
          {note.text}
        </p>
      )}

      <Card title="Your picture">
        <div className="max-w-xs">
          <ImageUpload value={avatar} onChange={onAvatar} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Saved as soon as it uploads. This is the same picture your Rego
          account uses everywhere.
        </p>
      </Card>

      <Card title="Set by Rego">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Fixed label="Employee code" value={profile.employee_code} />
          <Fixed label="Referral code" value={profile.referral_code} />
          <Fixed label="Department" value={profile.department.name} />
          <Fixed label="Role" value={profile.role.name} />
        </dl>
        <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
          <Lock className="mt-0.5 h-3 w-3 shrink-0" />
          These are set by an admin and cannot be changed here. Everything
          credited to you points at your employee code, so changing it would
          quietly re-attribute your work.
        </p>
      </Card>

      <Card title="About you">
        <div className="space-y-3">
          <Field label="Headline">
            <input
              value={form.headline}
              onChange={(e) => set("headline")(e.target.value)}
              className="auth-input"
              placeholder="e.g. Marketing executive, Skardu"
            />
          </Field>
          <Field label="A short bio">
            <textarea
              value={form.bio}
              onChange={(e) => set("bio")(e.target.value)}
              rows={4}
              className="auth-input"
              placeholder="What you do, and what you are good at."
            />
          </Field>
        </div>
      </Card>

      <Card title="Personal details">
        <p className="mb-3 text-xs text-muted-foreground">
          Only you and a Rego admin can see anything in this section. Your
          colleagues cannot — not your manager, not anyone else on the team.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Date of birth">
            <input
              type="date"
              value={form.date_of_birth}
              onChange={(e) => set("date_of_birth")(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Gender">
            <select
              value={form.gender}
              onChange={(e) => set("gender")(e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="">Prefer not to say</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g[0].toUpperCase() + g.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Personal email">
            <input
              type="email"
              value={form.personal_email}
              onChange={(e) => set("personal_email")(e.target.value)}
              className="auth-input"
            />
          </Field>
          <Field label="City">
            <input
              value={form.city}
              onChange={(e) => set("city")(e.target.value)}
              className="auth-input"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address">
              <input
                value={form.address}
                onChange={(e) => set("address")(e.target.value)}
                className="auth-input"
              />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Emergency contact">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Name">
            <input
              value={form.emergency_contact_name}
              onChange={(e) => set("emergency_contact_name")(e.target.value)}
              className="auth-input"
            />
          </Field>
          <Field label="Phone">
            <input
              value={form.emergency_contact_phone}
              onChange={(e) => set("emergency_contact_phone")(e.target.value)}
              className="auth-input"
              inputMode="tel"
            />
          </Field>
          <Field label="Relationship">
            <input
              value={form.emergency_contact_relation}
              onChange={(e) => set("emergency_contact_relation")(e.target.value)}
              className="auth-input"
              placeholder="e.g. brother"
            />
          </Field>
        </div>
      </Card>

      <Card title="Education">
        <RowList
          rows={education}
          onChange={setEducation}
          blank={{ qualification: "", institution: "", year: "" }}
          addLabel="Add a qualification"
          render={(row, update) => (
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                value={row.qualification}
                onChange={(e) => update({ ...row, qualification: e.target.value })}
                className="auth-input"
                placeholder="Qualification"
              />
              <input
                value={row.institution}
                onChange={(e) => update({ ...row, institution: e.target.value })}
                className="auth-input"
                placeholder="Institution"
              />
              <input
                value={row.year}
                onChange={(e) => update({ ...row, year: e.target.value })}
                className="auth-input"
                placeholder="Year"
                inputMode="numeric"
              />
            </div>
          )}
        />
      </Card>

      <Card title="Experience">
        <RowList
          rows={experience}
          onChange={setExperience}
          blank={{ title: "", organisation: "", from: "", to: "" }}
          addLabel="Add a job"
          render={(row, update) => (
            <div className="space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={row.title}
                  onChange={(e) => update({ ...row, title: e.target.value })}
                  className="auth-input"
                  placeholder="Job title"
                />
                <input
                  value={row.organisation}
                  onChange={(e) => update({ ...row, organisation: e.target.value })}
                  className="auth-input"
                  placeholder="Organisation"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={row.from}
                  onChange={(e) => update({ ...row, from: e.target.value })}
                  className="auth-input"
                  placeholder="From (e.g. 2021)"
                />
                <input
                  value={row.to}
                  onChange={(e) => update({ ...row, to: e.target.value })}
                  className="auth-input"
                  placeholder="To (or 'present')"
                />
              </div>
            </div>
          )}
        />
      </Card>

      <Card title="Skills">
        <ChipList
          values={skills}
          onChange={setSkills}
          placeholder="e.g. Copywriting"
        />
      </Card>

      <Card title="Languages">
        <RowList
          rows={languages}
          onChange={setLanguages}
          blank={{ name: "", level: "conversational" }}
          addLabel="Add a language"
          render={(row, update) => (
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={row.name}
                onChange={(e) => update({ ...row, name: e.target.value })}
                className="auth-input"
                placeholder="e.g. Balti"
              />
              <select
                value={row.level}
                onChange={(e) => update({ ...row, level: e.target.value })}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
              >
                {LANGUAGE_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l[0].toUpperCase() + l.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          )}
        />
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-forest px-6 py-3 text-sm font-semibold text-white shadow-premium disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save profile"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-lg font-bold text-forest">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-forest">{label}</span>
      {children}
    </label>
  );
}

function Fixed({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-forest">{value}</dd>
    </div>
  );
}

/* A repeating list of structured rows. One component for education, jobs and
   languages, because they differ only in which inputs they draw. */
function RowList<T>({
  rows,
  onChange,
  blank,
  addLabel,
  render,
}: {
  rows: T[];
  onChange: (rows: T[]) => void;
  blank: T;
  addLabel: string;
  render: (row: T, update: (next: T) => void) => React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-1">
            {render(row, (next) => onChange(rows.map((r, j) => (j === i ? next : r))))}
          </div>
          <button
            type="button"
            onClick={() => onChange(rows.filter((_, j) => j !== i))}
            aria-label="Remove"
            className="mt-1 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { ...blank }])}
        className="inline-flex items-center gap-1 text-sm font-semibold text-forest hover:underline"
      >
        <Plus className="h-4 w-4" />
        {addLabel}
      </button>
    </div>
  );
}

function ChipList({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = React.useState("");

  const add = () => {
    const v = draft.trim();
    /* Case-insensitive, because "Photography" and "photography" are one
       skill and a list containing both looks careless. */
    if (!v || values.some((s) => s.toLowerCase() === v.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...values, v]);
    setDraft("");
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {values.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-1 text-sm text-forest"
          >
            {s}
            <button
              type="button"
              onClick={() => onChange(values.filter((v) => v !== s))}
              aria-label={`Remove ${s}`}
              className="text-muted-foreground hover:text-red-600"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              /* Otherwise Enter submits whatever form this sits inside and
                 the person loses the rest of the page. */
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="auth-input flex-1"
        />
        <button
          type="button"
          onClick={add}
          className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-forest"
        >
          Add
        </button>
      </div>
    </div>
  );
}

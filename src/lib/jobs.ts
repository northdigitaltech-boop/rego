import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/* ============================================================
 * REGO Jobs Portal (phase 62)
 * Providers post vacancies from their dashboard → admin approves →
 * the job appears on the public /jobs portal → candidates apply.
 * ============================================================ */

/* ---------------- constants ---------------- */

export const EMPLOYMENT_TYPES = [
  "Full-time",
  "Part-time",
  "Contract",
  "Temporary",
  "Seasonal",
  "Internship",
  "Freelance",
] as const;

export const WORKPLACE_TYPES = ["On-site", "Remote", "Hybrid"] as const;

export const EXPERIENCE_LEVELS = [
  "No experience required",
  "Entry level",
  "1–2 years",
  "3–5 years",
  "5+ years",
] as const;

export const SALARY_PERIODS = ["month", "day", "hour", "project"] as const;

/** Job categories across tourism businesses. */
export const JOB_CATEGORIES = [
  "Hotel & Front Office",
  "Housekeeping",
  "Kitchen & Culinary",
  "Restaurant & Service",
  "Tour Guiding",
  "Trekking & Expedition Crew",
  "Driver & Transport",
  "Photography & Videography",
  "Sales & Reservations",
  "Marketing & Social Media",
  "Customer Support",
  "Accounts & Admin",
  "Maintenance & Security",
  "Activities & Adventure",
  "Management",
  "Other",
] as const;

export const GB_DISTRICTS = [
  "Skardu",
  "Shigar",
  "Kharmang",
  "Ghanche",
  "Roundu",
  "Gilgit",
  "Hunza",
  "Nagar",
  "Ghizer",
  "Astore",
  "Diamer",
  "Other",
] as const;

export type JobStatus =
  | "draft"
  | "pending"
  | "published"
  | "changes_required"
  | "rejected"
  | "paused"
  | "closed"
  | "expired";

export const JOB_STATUSES: { value: JobStatus; label: string; tone: string }[] = [
  { value: "draft", label: "Draft", tone: "bg-muted text-muted-foreground" },
  { value: "pending", label: "Pending Review", tone: "bg-amber-50 text-amber-700" },
  { value: "published", label: "Published", tone: "bg-green-50 text-green-700" },
  { value: "changes_required", label: "Changes Required", tone: "bg-orange-50 text-orange-700" },
  { value: "rejected", label: "Rejected", tone: "bg-red-50 text-red-600" },
  { value: "paused", label: "Paused", tone: "bg-blue-50 text-blue-700" },
  { value: "closed", label: "Closed", tone: "bg-muted text-muted-foreground" },
  { value: "expired", label: "Expired", tone: "bg-muted text-muted-foreground" },
];

export function statusMeta(status: string) {
  return (
    JOB_STATUSES.find((s) => s.value === status) ?? {
      value: status as JobStatus,
      label: status,
      tone: "bg-muted text-muted-foreground",
    }
  );
}

export type ApplicantStatus = "new" | "shortlisted" | "rejected" | "hired";

export const APPLICANT_STATUSES: { value: ApplicantStatus; label: string; tone: string }[] = [
  { value: "new", label: "New", tone: "bg-amber-50 text-amber-700" },
  { value: "shortlisted", label: "Shortlisted", tone: "bg-forest-50 text-forest-700" },
  { value: "rejected", label: "Rejected", tone: "bg-red-50 text-red-600" },
  { value: "hired", label: "Hired", tone: "bg-green-50 text-green-700" },
];

/* ---------------- types ---------------- */

export interface JobRow {
  id: string;
  slug: string | null;
  owner_email: string;
  business_name: string;
  business_category: string | null;
  business_logo: string | null;
  business_verified: boolean;
  title: string;
  category: string | null;
  description: string | null;
  responsibilities: string | null;
  skills: string | null;
  experience_level: string | null;
  employment_type: string;
  workplace_type: string;
  vacancies: number;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: string | null;
  salary_disclosed: boolean;
  district: string | null;
  city: string | null;
  deadline: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  cv_required: boolean;
  application_method: string;
  external_url: string | null;
  status: JobStatus | string;
  admin_note: string | null;
  featured: boolean;
  urgent: boolean;
  views: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export type JobInput = Partial<Omit<JobRow, "id" | "created_at" | "updated_at">> & {
  owner_email: string;
  business_name: string;
  title: string;
};

export interface JobApplicantRow {
  id: string;
  job_id: string;
  job_title: string | null;
  owner_email: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  location: string | null;
  intro: string | null;
  cover_letter: string | null;
  cv_url: string | null;
  status: ApplicantStatus | string;
  provider_note: string | null;
  created_at: string;
  updated_at: string;
}

/* ---------------- helpers ---------------- */

const norm = (e: string) => e.trim().toLowerCase();

/** URL-safe slug: "Hotel Receptionist" → "hotel-receptionist-skardu-a1b2". */
export function makeSlug(title: string, city?: string | null): string {
  const base = `${title} ${city ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`.replace(/-+/g, "-");
}

/** Human salary label, honouring "not disclosed". */
export function salaryLabel(j: JobRow): string {
  if (!j.salary_disclosed) return "Salary not disclosed";
  const per = j.salary_period ? `/${j.salary_period}` : "";
  const fmt = (n: number) => `PKR ${Number(n).toLocaleString()}`;
  if (j.salary_min && j.salary_max) return `${fmt(j.salary_min)} – ${fmt(j.salary_max)}${per}`;
  if (j.salary_min) return `From ${fmt(j.salary_min)}${per}`;
  if (j.salary_max) return `Up to ${fmt(j.salary_max)}${per}`;
  return "Salary not disclosed";
}

export function jobLocation(j: JobRow): string {
  return [j.city, j.district].filter(Boolean).join(", ") || "Gilgit-Baltistan";
}

/** True when the deadline has passed. */
export function isExpired(j: JobRow): boolean {
  if (!j.deadline) return false;
  return new Date(j.deadline) < new Date(new Date().toDateString());
}

/* ---------------- public reads ---------------- */

/** Flip any past-deadline published jobs to `expired` (cheap, idempotent). */
async function sweepExpired() {
  try {
    await supabase.rpc("expire_past_deadline_jobs");
  } catch {
    /* function may not exist yet — safe to ignore */
  }
}

export interface JobFilters {
  q?: string;
  category?: string;
  city?: string;
  employmentType?: string;
  businessCategory?: string;
}

/** Published jobs for the public portal. */
export async function getPublishedJobs(filters: JobFilters = {}): Promise<JobRow[]> {
  if (!isSupabaseConfigured) return [];
  await sweepExpired();
  let query = supabase
    .from("jobs")
    .select("*")
    .eq("status", "published")
    .order("featured", { ascending: false })
    .order("published_at", { ascending: false });

  if (filters.category) query = query.eq("category", filters.category);
  if (filters.city) query = query.eq("city", filters.city);
  if (filters.employmentType) query = query.eq("employment_type", filters.employmentType);
  if (filters.businessCategory) query = query.eq("business_category", filters.businessCategory);

  const { data, error } = await query;
  if (error) return [];
  let rows = (data ?? []) as JobRow[];

  // Text search across the fields people actually type.
  const q = filters.q?.trim().toLowerCase();
  if (q) {
    rows = rows.filter((j) =>
      `${j.title} ${j.business_name} ${j.category ?? ""} ${j.city ?? ""} ${j.district ?? ""} ${j.skills ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }
  return rows;
}

export async function getJobBySlug(slug: string): Promise<JobRow | null> {
  if (!isSupabaseConfigured || !slug) return null;
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return data as JobRow;
}

/** Same category or same city, excluding the current job. */
export async function getSimilarJobs(job: JobRow, limit = 4): Promise<JobRow[]> {
  const all = await getPublishedJobs();
  return all
    .filter((j) => j.id !== job.id)
    .sort((a, b) => {
      const score = (x: JobRow) =>
        (x.category === job.category ? 2 : 0) + (x.city === job.city ? 1 : 0);
      return score(b) - score(a);
    })
    .slice(0, limit);
}

/** Count published jobs (for the navbar badge / SEO copy). */
export async function countPublishedJobs(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const { count } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");
  return count ?? 0;
}

export async function incrementJobViews(id: string, current: number) {
  await supabase.from("jobs").update({ views: current + 1 }).eq("id", id);
}

/* ---------------- provider ---------------- */

/** Every job belonging to one provider (any status). */
export async function getMyJobs(ownerEmail: string): Promise<JobRow[]> {
  if (!isSupabaseConfigured || !ownerEmail) return [];
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("owner_email", norm(ownerEmail))
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as JobRow[];
}

export async function createJob(input: JobInput) {
  if (!isSupabaseConfigured) return { error: new Error("Not available right now.") };
  const payload = {
    ...input,
    owner_email: norm(input.owner_email),
    slug: input.slug || makeSlug(input.title, input.city),
    status: input.status ?? "pending",
  };
  const { data, error } = await supabase.from("jobs").insert(payload).select("*").maybeSingle();
  return { data: data as JobRow | null, error };
}

export async function updateJob(id: string, patch: Partial<JobRow>) {
  return supabase.from("jobs").update(patch).eq("id", id);
}

export async function deleteJob(id: string) {
  return supabase.from("jobs").delete().eq("id", id);
}

/** Provider re-submits after "changes required". */
export async function resubmitJob(id: string) {
  return supabase.from("jobs").update({ status: "pending", admin_note: null }).eq("id", id);
}

/* ---------------- admin ---------------- */

export async function getAllJobs(status?: string): Promise<JobRow[]> {
  if (!isSupabaseConfigured) return [];
  let q = supabase.from("jobs").select("*").order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as JobRow[];
}

export async function setJobStatus(id: string, status: JobStatus, adminNote?: string) {
  const patch: Partial<JobRow> = { status, admin_note: adminNote ?? null };
  if (status === "published") patch.published_at = new Date().toISOString();
  return supabase.from("jobs").update(patch).eq("id", id);
}

export async function setJobFlag(id: string, field: "featured" | "urgent", value: boolean) {
  return supabase.from("jobs").update({ [field]: value }).eq("id", id);
}

/* ---------------- applications ---------------- */

export interface ApplyInput {
  job_id: string;
  job_title: string;
  owner_email: string;
  full_name: string;
  email: string;
  phone?: string;
  location?: string;
  intro?: string;
  cover_letter?: string;
  cv_url?: string;
}

/**
 * Submit an application. Blocks duplicates (same email + job) and
 * applications sent after the deadline.
 */
export async function applyToJob(input: ApplyInput, job: JobRow) {
  if (!isSupabaseConfigured) return { error: new Error("Not available right now.") };
  if (job.status !== "published") {
    return { error: new Error("This job is no longer accepting applications.") };
  }
  if (isExpired(job)) {
    return { error: new Error("The application deadline for this job has passed.") };
  }

  const { data: dup } = await supabase
    .from("job_applicants")
    .select("id")
    .eq("job_id", input.job_id)
    .eq("email", norm(input.email))
    .maybeSingle();
  if (dup) {
    return { error: new Error("You've already applied for this job.") };
  }

  const { error } = await supabase.from("job_applicants").insert({
    job_id: input.job_id,
    job_title: input.job_title,
    owner_email: norm(input.owner_email),
    full_name: input.full_name.trim(),
    email: norm(input.email),
    phone: input.phone?.trim() || null,
    location: input.location?.trim() || null,
    intro: input.intro?.trim() || null,
    cover_letter: input.cover_letter?.trim() || null,
    cv_url: input.cv_url?.trim() || null,
  });
  return { error };
}

/** Applicants for one provider (optionally one job). */
export async function getApplicantsForOwner(
  ownerEmail: string,
  jobId?: string
): Promise<JobApplicantRow[]> {
  if (!isSupabaseConfigured || !ownerEmail) return [];
  let q = supabase
    .from("job_applicants")
    .select("*")
    .eq("owner_email", norm(ownerEmail))
    .order("created_at", { ascending: false });
  if (jobId) q = q.eq("job_id", jobId);
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as JobApplicantRow[];
}

/** Every application (admin only). */
export async function getAllApplicants(): Promise<JobApplicantRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("job_applicants")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as JobApplicantRow[];
}

/** A candidate's own applications. */
export async function getMyApplications(email: string): Promise<JobApplicantRow[]> {
  if (!isSupabaseConfigured || !email) return [];
  const { data, error } = await supabase
    .from("job_applicants")
    .select("*")
    .eq("email", norm(email))
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as JobApplicantRow[];
}

export async function setApplicantStatus(id: string, status: ApplicantStatus) {
  return supabase.from("job_applicants").update({ status }).eq("id", id);
}

export async function setApplicantNote(id: string, provider_note: string) {
  return supabase.from("job_applicants").update({ provider_note }).eq("id", id);
}

export async function deleteApplicant(id: string) {
  return supabase.from("job_applicants").delete().eq("id", id);
}

/* ---------------- Rego's own careers roles ---------------- */

/**
 * Rego's in-house openings (the /careers page) presented as portal jobs so
 * everything lives in one place. They aren't stored in the `jobs` table, so
 * they're synthesised on read and always link back to /careers to apply.
 */
export function careerToJob(o: {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  summary: string;
  responsibilities: string[];
}): JobRow {
  const now = new Date().toISOString();
  return {
    id: `rego-career-${o.id}`,
    slug: null,
    owner_email: "careers@rego.services",
    business_name: "Rego",
    business_category: "rego",
    business_logo: null,
    business_verified: true,
    title: o.title,
    category: o.department,
    description: o.summary,
    responsibilities: o.responsibilities.join("\n"),
    skills: null,
    experience_level: null,
    employment_type: o.type,
    workplace_type: "On-site",
    vacancies: 1,
    salary_min: null,
    salary_max: null,
    salary_period: null,
    salary_disclosed: false,
    district: null,
    city: o.location,
    deadline: null,
    contact_name: null,
    contact_phone: null,
    contact_email: "careers@rego.services",
    cv_required: true,
    application_method: "rego",
    external_url: null,
    status: "published",
    admin_note: null,
    featured: false,
    urgent: false,
    views: 0,
    published_at: now,
    created_at: now,
    updated_at: now,
  };
}

/* ---------------- business auto-link ---------------- */

export interface OwnerBusiness {
  name: string;
  category: string;
  logo: string | null;
  location: string | null;
  verified: boolean;
  phone: string | null;
}

/** Tables that hold a provider's registered business, with their columns. */
const BUSINESS_SOURCES: { table: string; category: string; nameCol: string }[] = [
  { table: "hotels", category: "hotels", nameCol: "title" },
  { table: "homestays", category: "homestays", nameCol: "title" },
  { table: "hostels", category: "hostels", nameCol: "title" },
  { table: "restaurants", category: "restaurants", nameCol: "name" },
  { table: "tour_companies", category: "travel-companies", nameCol: "name" },
  { table: "tour_guides", category: "guides", nameCol: "name" },
  { table: "transport_providers", category: "transport", nameCol: "name" },
  { table: "media_providers", category: "photographers", nameCol: "name" },
  { table: "coworking_spaces", category: "coworking", nameCol: "name" },
  { table: "roadside_providers", category: "roadside", nameCol: "business_name" },
  { table: "expedition_companies", category: "mountaineering", nameCol: "name" },
];

/**
 * Find the businesses registered to this provider so the job form can
 * auto-fill name, logo, category, location and contact details.
 */
export async function getOwnerBusinesses(ownerEmail: string): Promise<OwnerBusiness[]> {
  if (!isSupabaseConfigured || !ownerEmail) return [];
  const email = norm(ownerEmail);
  const found: OwnerBusiness[] = [];

  await Promise.all(
    BUSINESS_SOURCES.map(async (src) => {
      try {
        const { data } = await supabase
          .from(src.table)
          .select("*")
          .eq("owner_email", email);
        (data as Record<string, unknown>[] | null)?.forEach((r) => {
          const name = String(r[src.nameCol] ?? "").trim();
          if (!name) return;
          found.push({
            name,
            category: src.category,
            logo:
              (r.logo as string) ||
              (r.cover_image as string) ||
              (r.image as string) ||
              (r.profile_image as string) ||
              null,
            location:
              (r.location as string) || (r.city as string) || null,
            verified: Boolean(r.verified),
            phone: (r.phone as string) || (r.contact_phone as string) || null,
          });
        });
      } catch {
        /* table may not exist in this project — skip */
      }
    })
  );

  return found;
}

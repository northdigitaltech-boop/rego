// Rego careers — open positions shown on /careers.
// Applications go to the single Rego mailbox. There is no careers@ mailbox —
// sending there bounced with "550 User doesn't exist" and every application
// notification was lost. Sourced from siteConfig so one change moves them all.
// The array below is the built-in DEFAULT; admins can post/edit/close jobs from
// the admin panel and edits are stored in `careers_content` (phase57).

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { siteConfig } from "@/lib/site";

export const CAREERS_EMAIL = siteConfig.contactEmail;

export interface JobOpening {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string; // Full-time / Part-time / Contract
  summary: string;
  responsibilities: string[];
}

export const jobOpenings: JobOpening[] = [
  // Region-wise Marketing Managers
  {
    id: "mm-baltistan",
    title: "Regional Marketing Manager — Baltistan",
    department: "Marketing",
    location: "Skardu, Baltistan",
    type: "Full-time",
    summary:
      "Own Rego's growth across Baltistan (Skardu, Shigar, Khaplu, Roundu). Onboard hotels, guides, transport and tour operators, and grow local traveler awareness.",
    responsibilities: [
      "Sign up and support tourism providers across Baltistan",
      "Run local, on-ground marketing and community outreach",
      "Build relationships with hotels, operators and the tourism department",
      "Report regional signups, listings and bookings to head office",
    ],
  },
  {
    id: "mm-gilgit",
    title: "Regional Marketing Manager — Gilgit",
    department: "Marketing",
    location: "Gilgit",
    type: "Full-time",
    summary:
      "Lead provider onboarding and traveler growth across the Gilgit region and act as Rego's local face for partners and events.",
    responsibilities: [
      "Onboard hotels, guides, transport and activity providers in Gilgit",
      "Drive local awareness campaigns and partnerships",
      "Support providers with listings, photos and go-live",
      "Track and report regional performance",
    ],
  },
  {
    id: "mm-hunza-nagar",
    title: "Regional Marketing Manager — Hunza & Nagar",
    department: "Marketing",
    location: "Hunza & Nagar",
    type: "Full-time",
    summary:
      "Grow Rego across the Hunza and Nagar valleys — a flagship tourism region — by onboarding premium stays, operators and guides.",
    responsibilities: [
      "Recruit and onboard providers across Hunza and Nagar",
      "Build partnerships with hotels, homestays and tour companies",
      "Coordinate seasonal campaigns around peak tourism months",
      "Report signups, listings and bookings",
    ],
  },
  {
    id: "mm-ghizer",
    title: "Regional Marketing Manager — Ghizer",
    department: "Marketing",
    location: "Ghizer",
    type: "Full-time",
    summary:
      "Develop Rego's presence across Ghizer (Gupis, Yasin, Phander) — connecting emerging tourism businesses to travelers.",
    responsibilities: [
      "Identify and onboard tourism providers across Ghizer",
      "Run community-level awareness and outreach",
      "Support new providers through listing and verification",
      "Report regional growth to head office",
    ],
  },
  {
    id: "mm-astore",
    title: "Regional Marketing Manager — Astore",
    department: "Marketing",
    location: "Astore",
    type: "Full-time",
    summary:
      "Represent Rego across the Astore valley (Rama, Deosai gateway) — onboarding stays, jeep operators and guides for a fast-growing destination.",
    responsibilities: [
      "Onboard hotels, camps, transport and guides across Astore",
      "Promote Rego to local travelers and businesses",
      "Assist providers with going live and staying updated",
      "Track and report regional performance",
    ],
  },
];

/** Positions grouped by department (from any job list). */
export function jobsByDepartment(
  jobs: JobOpening[] = jobOpenings
): { department: string; jobs: JobOpening[] }[] {
  const map = new Map<string, JobOpening[]>();
  for (const j of jobs) {
    map.set(j.department, [...(map.get(j.department) ?? []), j]);
  }
  return Array.from(map.entries()).map(([department, list]) => ({ department, jobs: list }));
}

/* ---------------- admin-manageable store ---------------- */

/** Live job openings: admin-posted from Supabase, else the built-in defaults. */
export async function getJobOpenings(): Promise<JobOpening[]> {
  if (!isSupabaseConfigured) return jobOpenings;
  try {
    const { data, error } = await supabase
      .from("careers_content")
      .select("content")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data?.content) return jobOpenings;
    const stored = data.content as JobOpening[];
    return Array.isArray(stored) ? stored : jobOpenings;
  } catch {
    return jobOpenings;
  }
}

/** Upsert the full job list (admin only, app-gated). */
export async function saveJobOpenings(jobs: JobOpening[]) {
  return supabase
    .from("careers_content")
    .upsert({ id: 1, content: jobs, updated_at: new Date().toISOString() });
}

/* ---------------- job applications (phase59) ---------------- */

export type ApplicationStatus =
  | "new"
  | "shortlisted"
  | "interview"
  | "rejected"
  | "hired";

export const APPLICATION_STATUSES: { value: ApplicationStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "shortlisted", label: "Shortlisted" },
  { value: "interview", label: "Interview" },
  { value: "rejected", label: "Rejected" },
  { value: "hired", label: "Hired" },
];

/** Marketing / field skills an applicant can tick. */
export const MARKETING_SKILLS: string[] = [
  "Meta (Facebook/Instagram) Ads",
  "Google Ads",
  "TikTok / YouTube marketing",
  "Physical / on-ground marketing",
  "Tourism industry experience",
  "Social media management",
  "Content creation & photography",
  "Sales & provider onboarding",
  "SEO / content writing",
  "Email & WhatsApp marketing",
  "Event & expo marketing",
  "Graphic design (Canva/Adobe)",
];

/** Yes / No / Some screening questions asked on the apply form. */
export const SCREENING_QUESTIONS: {
  key: "ran_paid_ads" | "tourism_exp" | "has_vehicle" | "can_travel";
  label: string;
  options: string[];
}[] = [
  {
    key: "ran_paid_ads",
    label: "Have you run paid ad campaigns before (Meta / Google)?",
    options: ["Yes", "Some", "No"],
  },
  {
    key: "tourism_exp",
    label: "Do you have experience in the tourism / hospitality industry?",
    options: ["Yes", "Some", "No"],
  },
  {
    key: "has_vehicle",
    label: "Do you have a bike or car for field visits?",
    options: ["Yes", "No"],
  },
  {
    key: "can_travel",
    label: "Can you travel across your region for provider meetings?",
    options: ["Yes", "No"],
  },
];

export interface JobApplicationRow {
  id: string;
  job_id: string | null;
  job_title: string;
  department: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  city: string | null;
  experience: string | null;
  cover_note: string | null;
  cv_url: string | null;
  skills: string[] | null;
  ran_paid_ads: string | null;
  tourism_exp: string | null;
  has_vehicle: string | null;
  can_travel: string | null;
  portfolio_url: string | null;
  status: ApplicationStatus | string;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobApplicationInput {
  job_id?: string | null;
  job_title: string;
  department?: string | null;
  full_name: string;
  email: string;
  phone?: string | null;
  city?: string | null;
  experience?: string | null;
  cover_note?: string | null;
  cv_url?: string | null;
  skills?: string[];
  ran_paid_ads?: string | null;
  tourism_exp?: string | null;
  has_vehicle?: string | null;
  can_travel?: string | null;
  portfolio_url?: string | null;
}

/** Submit an application from the public careers page. */
export async function submitApplication(input: JobApplicationInput) {
  if (!isSupabaseConfigured) {
    return { error: new Error("Applications are not available right now.") };
  }
  const { error } = await supabase.from("job_applications").insert({
    job_id: input.job_id ?? null,
    job_title: input.job_title,
    department: input.department ?? null,
    full_name: input.full_name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone?.trim() || null,
    city: input.city?.trim() || null,
    experience: input.experience?.trim() || null,
    cover_note: input.cover_note?.trim() || null,
    cv_url: input.cv_url?.trim() || null,
    skills: input.skills ?? [],
    ran_paid_ads: input.ran_paid_ads || null,
    tourism_exp: input.tourism_exp || null,
    has_vehicle: input.has_vehicle || null,
    can_travel: input.can_travel || null,
    portfolio_url: input.portfolio_url?.trim() || null,
  });
  return { error };
}

/** All applications, newest first (admin). */
export async function getApplications(): Promise<JobApplicationRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("job_applications")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getApplications:", error.message);
    return [];
  }
  return (data ?? []) as JobApplicationRow[];
}

export async function setApplicationStatus(id: string, status: ApplicationStatus) {
  return supabase.from("job_applications").update({ status }).eq("id", id);
}

export async function setApplicationNote(id: string, admin_note: string) {
  return supabase.from("job_applications").update({ admin_note }).eq("id", id);
}

export async function deleteApplication(id: string) {
  return supabase.from("job_applications").delete().eq("id", id);
}

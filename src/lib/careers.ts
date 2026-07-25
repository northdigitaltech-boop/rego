// Rego careers — open positions shown on /careers.
// Applications go to careers@rego.services (mailto with a pre-filled subject).
// The array below is the built-in DEFAULT; admins can post/edit/close jobs from
// the admin panel and edits are stored in `careers_content` (phase57).

import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const CAREERS_EMAIL = "careers@rego.services";

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

"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import {
  BookOpen,
  Briefcase,
  CalendarDays,
  Compass,
  FileText,
  ImagePlus,
  Info,
  LayoutGrid,
  MapPin,
  Megaphone,
  Mountain,
  Phone,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";

/* ============================================================
 * The admin modules a team member can be given.
 *
 * ONE LIST, TWO CONSUMERS
 *   The portal reads it to decide which tabs to draw. Nothing else
 *   should hold a second copy — the permission slug, the component
 *   and the label belong together, and the way this goes wrong is a
 *   tab whose slug no longer matches the policy protecting it.
 *
 * EVERY ENTRY IS REAL
 *   Each `needs` slug exists in staff_permissions (phase110) AND has
 *   a matching `staff110_*` policy on the tables its component
 *   writes to. A tab here that opened a screen the database then
 *   refused would be worse than no tab.
 *
 * NOT HERE, ON PURPOSE
 *   Password Update Clients, Manage & Delete, Legal & Policies, Send
 *   Notification, Subscription & Monetization, Team Management and
 *   Users. Passwords, deletion, legal text, mass email, money and
 *   permissions stay with Super Admin.
 *
 *   Also absent: Listings, Add Listing, Approvals, Edit Requests and
 *   Verification. Those write to the listing tables, whose policies
 *   are about rows and silent about columns — see
 *   MARKETING-ADMIN-MAP.md section 0. They come after that is fixed.
 *
 * LOADED ON DEMAND
 *   next/dynamic, because these are large admin screens and a
 *   marketing person who only has two of them should not download
 *   all sixteen.
 * ============================================================ */

export interface PortalModule {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Any one of these opens it. Checked again by the database on write. */
  needs: string[];
  Component: ComponentType;
}

/* ssr:false because these are admin screens that read the browser session
   the moment they mount. loading:null rather than a spinner — the tab is
   already the feedback that something is opening. */
const load = (fn: () => Promise<ComponentType>): ComponentType =>
  dynamic(fn, { ssr: false, loading: () => null }) as ComponentType;

export const PORTAL_MODULES: PortalModule[] = [
  {
    id: "events",
    label: "Events & Expo",
    icon: CalendarDays,
    needs: ["manage_events"],
    Component: load(() =>
      import("@/components/dashboard/admin-events").then((m) => m.AdminEvents)
    ),
  },
  {
    id: "road-updates",
    label: "Road Updates & Alerts",
    icon: TriangleAlert,
    needs: ["manage_road_updates"],
    Component: load(() =>
      import("@/components/dashboard/admin-road-updates").then((m) => m.AdminRoadUpdates)
    ),
  },
  {
    id: "safarnama",
    label: "Safarnama Stories",
    icon: BookOpen,
    needs: ["manage_safarnama"],
    Component: load(() =>
      import("@/components/dashboard/admin-safarnama").then((m) => m.AdminSafarnama)
    ),
  },
  {
    id: "regomap",
    label: "Rego Map",
    icon: MapPin,
    needs: ["manage_rego_map"],
    Component: load(() =>
      import("@/components/dashboard/admin-rego-map").then((m) => m.AdminRegoMap)
    ),
  },
  {
    id: "coworking",
    label: "Co-working Spaces",
    icon: Briefcase,
    needs: ["manage_coworking"],
    Component: load(() =>
      import("@/components/dashboard/admin-coworking").then((m) => m.AdminCoworking)
    ),
  },
  {
    id: "expeditions",
    label: "Mountaineering & Expeditions",
    icon: Mountain,
    needs: ["manage_expeditions"],
    Component: load(() =>
      import("@/components/dashboard/admin-expeditions").then((m) => m.AdminExpeditions)
    ),
  },
  {
    id: "jobs-portal",
    label: "Jobs Portal",
    icon: Briefcase,
    needs: ["manage_jobs_portal"],
    Component: load(() =>
      import("@/components/dashboard/admin-jobs").then((m) => m.AdminJobs)
    ),
  },
  {
    id: "careers",
    label: "Careers & Jobs",
    icon: Briefcase,
    needs: ["manage_careers"],
    Component: load(() =>
      import("@/components/dashboard/admin-careers").then((m) => m.AdminCareers)
    ),
  },
  {
    id: "applications",
    label: "Job Applications",
    icon: FileText,
    needs: ["manage_job_applications"],
    Component: load(() =>
      import("@/components/dashboard/admin-applications").then((m) => m.AdminApplications)
    ),
  },
  {
    id: "about",
    label: "About Page",
    icon: Info,
    needs: ["manage_about_page"],
    Component: load(() =>
      import("@/components/dashboard/admin-about").then((m) => m.AdminAbout)
    ),
  },
  {
    id: "contact",
    label: "Contact Page",
    icon: Phone,
    needs: ["manage_contact_page"],
    Component: load(() =>
      import("@/components/dashboard/admin-contact").then((m) => m.AdminContact)
    ),
  },
  {
    id: "ads",
    label: "Promotions & Ads",
    icon: Megaphone,
    needs: ["manage_promotions"],
    Component: load(() =>
      import("@/components/dashboard/admin-ads").then((m) => m.AdminAds)
    ),
  },
  {
    id: "hero",
    label: "Homepage Hero",
    icon: ImagePlus,
    needs: ["manage_homepage_hero"],
    Component: load(() =>
      import("@/components/dashboard/admin-hero-image").then((m) => m.AdminHeroImage)
    ),
  },
  {
    id: "solo",
    label: "Connect Solo Traveler",
    icon: Compass,
    needs: ["manage_solo_travelers"],
    Component: load(() =>
      import("@/components/dashboard/admin-solo").then((m) => m.AdminSolo)
    ),
  },
  {
    id: "service-requests",
    label: "Service Requests",
    icon: LayoutGrid,
    needs: ["manage_service_requests"],
    Component: load(() =>
      import("@/components/dashboard/admin-service-requests").then(
        (m) => m.AdminServiceRequests
      )
    ),
  },
];

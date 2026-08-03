import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { siteConfig } from "@/lib/site";

/* ============================================================
 * Contact page content — admin-editable (phase 63).
 * Falls back to these defaults until an admin saves changes,
 * so the page always renders even before the migration is run.
 * ============================================================ */

export interface ContactSocial {
  /** facebook | instagram | youtube | whatsapp | tiktok | linkedin */
  platform: string;
  href: string;
}

export interface ContactContent {
  /** Hero */
  eyebrow: string;
  title: string;
  intro: string;

  /** "Reach us directly" block */
  detailsHeading: string;
  phone: string;
  email: string;
  office: string;
  hours: string;

  /** Social block */
  socialHeading: string;
  socialIntro: string;
  socials: ContactSocial[];

  /** Form block */
  formHeading: string;
}

export const DEFAULT_CONTACT: ContactContent = {
  eyebrow: "Get in touch",
  title: "Contact Us",
  intro:
    "Questions about a booking or planning a trip to Gilgit Baltistan? Our team is here around the clock.",

  detailsHeading: "Reach us directly",
  phone: siteConfig.contactPhone,
  email: "northdigitaltech@gmail.com",
  office: "Skardu, Gilgit Baltistan, Pakistan",
  hours: "Open 24/7 — we're always here to help",

  socialHeading: "Follow us",
  socialIntro: "Stay connected for the latest from Gilgit Baltistan.",
  socials: [
    { platform: "facebook", href: "https://facebook.com" },
    { platform: "instagram", href: "https://instagram.com" },
    { platform: "youtube", href: "https://youtube.com" },
    {
      platform: "whatsapp",
      href: `https://wa.me/${siteConfig.contactPhone.replace(/[^\d]/g, "")}`,
    },
  ],

  formHeading: "Send us a message",
};

/** Live content: admin-saved from Supabase, else the built-in defaults. */
export async function getContactContent(): Promise<ContactContent> {
  if (!isSupabaseConfigured) return DEFAULT_CONTACT;
  try {
    const { data, error } = await supabase
      .from("contact_content")
      .select("content")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data?.content) return DEFAULT_CONTACT;
    // Merge so newly-added fields always have a value.
    return { ...DEFAULT_CONTACT, ...(data.content as Partial<ContactContent>) };
  } catch {
    return DEFAULT_CONTACT;
  }
}

/** Upsert the whole contact page (admin only, app-gated). */
export async function saveContactContent(content: ContactContent) {
  return supabase
    .from("contact_content")
    .upsert({ id: 1, content, updated_at: new Date().toISOString() });
}

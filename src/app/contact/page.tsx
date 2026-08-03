import type { Metadata } from "next";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Facebook,
  Instagram,
  Youtube,
  Linkedin,
  MessageCircle,
  Music2,
  Twitter,
  Briefcase,
} from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ContactForm } from "@/components/contact/contact-form";
import { getContactContent } from "@/lib/contact-content";
import { photo } from "@/lib/utils";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with the Rego team for help planning your trip to Gilgit Baltistan.",
};

/** Social platform → icon. Unknown platforms fall back to a link glyph. */
const SOCIAL_ICONS: Record<string, typeof Facebook> = {
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  whatsapp: MessageCircle,
  linkedin: Linkedin,
  tiktok: Music2,
  x: Twitter,
};

export default async function ContactPage() {
  const c = await getContactContent();

  const details = [
    { icon: Phone, label: "Phone", value: c.phone, href: `tel:${c.phone.replace(/\s+/g, "")}` },
    { icon: Mail, label: "Email", value: c.email, href: `mailto:${c.email}` },
    { icon: MapPin, label: "Office", value: c.office },
    { icon: Clock, label: "Hours", value: c.hours },
  ];

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="bg-gradient-forest py-14 text-white">
          <div className="container-px">
            <p className="font-script text-3xl text-gold">{c.eyebrow}</p>
            <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{c.title}</h1>
            <p className="mt-3 max-w-xl text-white/85">{c.intro}</p>
            <a
              href="/careers"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-gold px-4 py-2 text-sm font-bold text-forest-900 shadow-gold-glow transition-transform hover:-translate-y-0.5"
            >
              <Briefcase className="h-4 w-4" /> We&apos;re hiring — view careers
            </a>
          </div>
        </section>

        <section className="bg-background py-14">
          <div className="container-px grid gap-10 lg:grid-cols-[1fr_1.3fr]">
            {/* Details */}
            <div id="support" className="scroll-mt-24">
              <h2 className="font-display text-2xl font-bold text-forest">
                {c.detailsHeading}
              </h2>
              <div className="mt-6 space-y-5">
                {details.map((d) => {
                  const Icon = d.icon;
                  return (
                    <div key={d.label} className="flex items-start gap-4">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-600">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-forest">{d.label}</p>
                        {/* Phone and email are tappable on mobile. */}
                        {d.href ? (
                          <a
                            href={d.href}
                            className="break-words text-muted-foreground transition-colors hover:text-forest-600"
                          >
                            {d.value}
                          </a>
                        ) : (
                          <p className="break-words text-muted-foreground">{d.value}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 h-56 overflow-hidden rounded-2xl shadow-premium">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo(
                    "https://loremflickr.com/800/500/skardu,town,mountains?lock=53"
                  )}
                  alt="Skardu, Gilgit Baltistan"
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Social media */}
              {c.socials.length > 0 && (
                <div id="social" className="mt-8 scroll-mt-24">
                  <h3 className="font-display text-lg font-bold text-forest">
                    {c.socialHeading}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{c.socialIntro}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {c.socials
                      .filter((s) => s.href.trim())
                      .map((s, i) => {
                        const Icon = SOCIAL_ICONS[s.platform] ?? MessageCircle;
                        return (
                          <a
                            key={`${s.platform}-${i}`}
                            href={s.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={s.platform}
                            className="grid h-11 w-11 place-items-center rounded-xl bg-forest-50 text-forest-600 transition-colors hover:bg-gold hover:text-forest-900"
                          >
                            <Icon className="h-5 w-5" />
                          </a>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Form */}
            <div id="form" className="scroll-mt-24">
              <h2 className="mb-6 font-display text-2xl font-bold text-forest">
                {c.formHeading}
              </h2>
              <ContactForm />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

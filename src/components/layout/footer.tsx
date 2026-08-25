import Link from "next/link";
import {
  Phone,
  Mail,
  MapPin,
  Facebook,
  Instagram,
  Youtube,
  MessageCircle,
  Play,
  Apple,
  ShieldCheck,
} from "lucide-react";

import { BrandLogo } from "@/components/layout/logo";
import { HelplineLink } from "@/components/layout/helpline-link";
import { legalPolicies } from "@/lib/legal";
import { siteConfig, contactLinks, companyRegistration } from "@/lib/site";
import { InstallAppButton } from "@/components/pwa/install-app-button";

const quickLinks = [
  { label: "Services", href: "/listings" },
  { label: "Activities", href: "/categories/camping" },
  { label: "Roadside Assistance", href: "/categories/vehicle-recovery" },
  { label: "Events & Expo", href: "/categories/festivals" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "About Us", href: "/about" },
  { label: "Careers", href: "/careers" },
  { label: "Become a Partner", href: "/partner" },
  { label: "Contact Us", href: "/contact" },
  // E-E-A-T: a reader can check how the travel information here is produced.
  { label: "Editorial Policy", href: "/editorial-policy" },
];

const topDestinations = [
  { label: "Skardu", href: "/destinations/skardu" },
  { label: "Hunza Valley", href: "/destinations/hunza" },
  { label: "Naran Valley", href: "/destinations/naran" },
  { label: "Deosai Plains", href: "/destinations/deosai" },
  { label: "Fairy Meadows", href: "/destinations/fairy-meadows" },
];

const socials = [Facebook, Instagram, Youtube, MessageCircle];

export function Footer() {
  return (
    <footer className="border-t-4 border-gold/80 bg-forest-800 text-white/75">
      <div className="container-px py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
          {/* Brand */}
          <div className="max-w-xs">
            <Link href="/" aria-label="Rego home" className="inline-block">
              <BrandLogo className="h-20 w-auto mix-blend-screen" />
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-white/65">
              Rego is your complete travel marketplace for exploring the beauty
              of Gilgit Baltistan.
            </p>

            {/* Company registration.
                The verify link is the point — anyone can print a claim, so the
                value is that this one can be checked on the public SECP
                record. Kept to two lines so it reads as a credential rather
                than a legal notice. */}
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-white/90">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-gold" />
                Registered with {companyRegistration.regulator}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-white/60">
                {companyRegistration.shortLegalName}
                <br />
                CUIN{" "}
                <a
                  href={companyRegistration.verifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-white/80 underline decoration-gold/50 underline-offset-2 transition-colors hover:text-gold"
                >
                  {companyRegistration.cuin}
                </a>
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="mb-4 font-display text-sm font-semibold text-white">
              Quick Links
            </h4>
            <ul className="space-y-2.5 text-sm">
              {quickLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-white/65 transition-colors hover:text-gold"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Top Destinations */}
          <div>
            <h4 className="mb-4 font-display text-sm font-semibold text-white">
              Top Destinations
            </h4>
            <ul className="space-y-2.5 text-sm">
              {topDestinations.map((d) => (
                <li key={d.label}>
                  <Link
                    href={d.href}
                    className="flex items-center gap-2 text-white/65 transition-colors hover:text-gold"
                  >
                    <MapPin className="h-3.5 w-3.5 text-gold" />
                    {d.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact + App */}
          <div>
            <h4 className="mb-4 font-display text-sm font-semibold text-white">
              Contact Us
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                {/* Same admin-editable number as the Contact page and the
                    navbar. This was hardcoded, so editing it in the admin
                    left the footer showing the old one. */}
                <HelplineLink
                  className="flex items-center gap-2 text-white/65 transition-colors hover:text-gold"
                  icon={<Phone className="h-4 w-4 shrink-0 text-gold" />}
                />
              </li>
              <li>
                <a
                  href={contactLinks.mail}
                  className="flex items-center gap-2 break-all text-white/65 transition-colors hover:text-gold"
                >
                  <Mail className="h-4 w-4 shrink-0 text-gold" />
                  {siteConfig.contactEmail}
                </a>
              </li>
              <li className="flex items-start gap-2 text-white/65">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                {siteConfig.address}
              </li>
            </ul>

            <h4 className="mb-3 mt-6 font-display text-sm font-semibold text-white">
              Follow Us
            </h4>
            <div className="flex items-center gap-3">
              {socials.map((Icon, i) => (
                <Link
                  key={i}
                  href="#"
                  aria-label="social link"
                  className="grid h-9 w-9 place-items-center rounded-full bg-white/10 transition-colors hover:bg-gold hover:text-forest-900"
                >
                  <Icon className="h-4 w-4" />
                </Link>
              ))}
            </div>

            {/* The web app is the app, and it can be installed today — so it
                leads, above the stores that are still "coming soon". This is
                also the only route to the install card once its own
                once-per-session appearance has been used up. */}
            <h4 className="mb-3 mt-6 font-display text-sm font-semibold text-white">
              Get the app
            </h4>
            <div className="mb-3">
              <InstallAppButton />
            </div>

            <h4 className="mb-3 font-display text-sm font-semibold text-white">
              Coming Soon
            </h4>
            <div className="flex flex-wrap gap-2">
              <Link
                href="#"
                className="flex items-center gap-2 rounded-lg bg-black px-3 py-2 transition-opacity hover:opacity-90"
              >
                <Play className="h-5 w-5 fill-white text-white" />
                <span className="flex flex-col leading-tight">
                  <span className="text-[8px] text-white/70">GET IT ON</span>
                  <span className="text-xs font-semibold text-white">
                    Google Play
                  </span>
                </span>
              </Link>
              <Link
                href="#"
                className="flex items-center gap-2 rounded-lg bg-black px-3 py-2 transition-opacity hover:opacity-90"
              >
                <Apple className="h-5 w-5 fill-white text-white" />
                <span className="flex flex-col leading-tight">
                  <span className="text-[8px] text-white/70">Download on the</span>
                  <span className="text-xs font-semibold text-white">App Store</span>
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Legal */}
        <div className="mt-12 border-t border-white/10 pt-6">
          <h4 className="mb-3 font-display text-sm font-semibold text-white">
            Legal
          </h4>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {legalPolicies.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/legal/${p.slug}`}
                  className="text-white/65 transition-colors hover:text-gold"
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* /50 failed the 4.5:1 contrast requirement — /75 passes comfortably. */}
        <div className="mt-8 border-t border-white/10 pt-6 text-center text-xs text-white/75">
          © {new Date().getFullYear()} Rego. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

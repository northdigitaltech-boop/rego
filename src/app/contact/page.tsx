import type { Metadata } from "next";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Facebook,
  Instagram,
  Youtube,
  MessageCircle,
} from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ContactForm } from "@/components/contact/contact-form";
import { photo } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with the Rego team for help planning your trip to Gilgit Baltistan.",
};

const details = [
  { icon: Phone, label: "Phone", value: "+92 300 1234567" },
  { icon: Mail, label: "Email", value: "info@rego.com" },
  { icon: MapPin, label: "Office", value: "Skardu, Gilgit Baltistan, Pakistan" },
  { icon: Clock, label: "Hours", value: "Open 24/7 — we're always here to help" },
];

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="bg-gradient-forest py-14 text-white">
          <div className="container-px">
            <p className="font-script text-3xl text-gold">Get in touch</p>
            <h1 className="font-display text-4xl font-extrabold sm:text-5xl">
              Contact Us
            </h1>
            <p className="mt-3 max-w-xl text-white/85">
              Questions about a booking or planning a trip to Gilgit Baltistan?
              Our team is here around the clock.
            </p>
          </div>
        </section>

        <section className="bg-background py-14">
          <div className="container-px grid gap-10 lg:grid-cols-[1fr_1.3fr]">
            {/* Details */}
            <div id="support" className="scroll-mt-24">
              <h2 className="font-display text-2xl font-bold text-forest">
                Reach us directly
              </h2>
              <div className="mt-6 space-y-5">
                {details.map((d) => {
                  const Icon = d.icon;
                  return (
                    <div key={d.label} className="flex items-start gap-4">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-600">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-forest">
                          {d.label}
                        </p>
                        <p className="text-muted-foreground">{d.value}</p>
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
                  className="h-full w-full object-cover"
                />
              </div>

              {/* Social media */}
              <div id="social" className="mt-8 scroll-mt-24">
                <h3 className="font-display text-lg font-bold text-forest">
                  Follow us
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Stay connected for the latest from Gilgit Baltistan.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  {[
                    { Icon: Facebook, href: "https://facebook.com", label: "Facebook" },
                    { Icon: Instagram, href: "https://instagram.com", label: "Instagram" },
                    { Icon: Youtube, href: "https://youtube.com", label: "YouTube" },
                    {
                      Icon: MessageCircle,
                      href: "https://wa.me/923001234567",
                      label: "WhatsApp",
                    },
                  ].map(({ Icon, href, label }) => (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="grid h-11 w-11 place-items-center rounded-xl bg-forest-50 text-forest-600 transition-colors hover:bg-gold hover:text-forest-900"
                    >
                      <Icon className="h-5 w-5" />
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Form */}
            <div id="form" className="scroll-mt-24">
              <h2 className="mb-6 font-display text-2xl font-bold text-forest">
                Send us a message
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

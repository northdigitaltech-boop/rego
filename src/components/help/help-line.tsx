"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Headset,
  Phone,
  MessageCircle,
  MapPin,
  Car,
  Hotel,
  Backpack,
  Shield,
  Ambulance,
  LifeBuoy,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Configure these with Rego's real numbers (placeholders below).  */
/* WhatsApp must be digits only, international format, no + or spaces.  */
/* ------------------------------------------------------------------ */
const HELPLINE_TEL = "+925811920001";
const WHATSAPP_NUM = "923400000000";

const EMERGENCY = [
  { label: "Tourism Helpline", tel: "1422", Icon: LifeBuoy },
  { label: "Police", tel: "15", Icon: Shield },
  { label: "Rescue Service", tel: "1122", Icon: LifeBuoy },
  { label: "Ambulance", tel: "1122", Icon: Ambulance },
];

export function HelpLine() {
  const [open, setOpen] = React.useState(false);

  // Esc to close + lock body scroll while open.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const shareLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const maps = `https://maps.google.com/?q=${latitude},${longitude}`;
        window.open(
          `https://wa.me/${WHATSAPP_NUM}?text=${encodeURIComponent(`My current location: ${maps}`)}`,
          "_blank",
          "noopener,noreferrer"
        );
      },
      () => {
        /* permission denied — do nothing */
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <>
      {/* Floating button — fixed bottom-right, always on top */}
      <div className="fixed bottom-5 right-5 z-[90]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open 24/7 Tourist Help Line"
          className="group flex items-center"
        >
          {/* hover label (expands to the left) */}
          <span className="mr-2 hidden max-w-0 overflow-hidden whitespace-nowrap rounded-full bg-card/90 py-2 text-sm font-semibold text-forest shadow-premium backdrop-blur-md transition-all duration-300 group-hover:max-w-[220px] group-hover:px-4 lg:inline-block">
            24/7 Tourist Help Line
          </span>
          {/* red emergency circle with pulsing ring */}
          <span className="relative grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg ring-2 ring-white/40 sm:h-14 sm:w-14">
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full bg-red-500/60"
              animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 1.5, ease: "easeOut" }}
            />
            <Headset className="relative h-6 w-6 sm:h-7 sm:w-7" />
          </span>
        </button>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[120] flex items-stretch justify-center bg-forest-900/60 backdrop-blur-sm sm:items-center sm:p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="helpline-title"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 30, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 30, scale: 0.98 }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              className="flex h-full w-full flex-col overflow-hidden bg-card shadow-premium-lg sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-3xl"
            >
              {/* header */}
              <div className="flex items-start justify-between gap-3 bg-gradient-to-br from-red-500 to-red-600 px-5 py-4 text-white">
                <div>
                  <h2 id="helpline-title" className="font-display text-lg font-bold">
                    🚨 Rego Tourist Help Line
                  </h2>
                  <p className="mt-0.5 text-sm text-white/85">
                    Emergency help, bookings, road &amp; weather, transport and travel guidance.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close help line"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto p-5">
                <p className="text-sm text-muted-foreground">
                  Need assistance during your trip? Contact our support team for emergency help,
                  booking issues, road conditions, weather updates, transport assistance, or general
                  travel guidance.
                </p>

                {/* quick actions */}
                <div className="grid grid-cols-2 gap-2.5">
                  <Action href={`tel:${HELPLINE_TEL}`} Icon={Phone} label="Call Help Line" primary />
                  <Action
                    href={`https://wa.me/${WHATSAPP_NUM}`}
                    Icon={MessageCircle}
                    label="WhatsApp Support"
                    external
                  />
                  <Action onClick={shareLocation} Icon={MapPin} label="Share Location" />
                  <Action href="/categories/transport" Icon={Car} label="Roadside Assistance" internal />
                  <Action href="/categories/hotels" Icon={Hotel} label="Hotel Booking Support" internal />
                  <Action href="/categories/guides" Icon={Backpack} label="Tour Guide Assistance" internal />
                </div>

                {/* emergency contacts */}
                <div>
                  <h3 className="mb-2 font-display text-sm font-bold text-forest">Emergency contacts</h3>
                  <div className="grid grid-cols-2 gap-2.5">
                    {EMERGENCY.map(({ label, tel, Icon }) => (
                      <a
                        key={label}
                        href={`tel:${tel}`}
                        className="flex items-center gap-2.5 rounded-xl border border-border bg-background/60 px-3 py-2.5 transition-colors hover:border-red-300 hover:bg-red-50"
                      >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-forest">{label}</span>
                          <span className="block text-xs text-muted-foreground">{tel}</span>
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Action({
  href,
  onClick,
  Icon,
  label,
  primary,
  external,
  internal,
}: {
  href?: string;
  onClick?: () => void;
  Icon: typeof Phone;
  label: string;
  primary?: boolean;
  external?: boolean;
  internal?: boolean;
}) {
  const cls =
    "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors " +
    (primary
      ? "border-transparent bg-gradient-forest text-white hover:opacity-95"
      : "border-border bg-card text-forest hover:border-forest/40");
  const inner = (
    <>
      <Icon className="h-5 w-5 shrink-0" />
      <span className="truncate">{label}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  }
  if (internal && href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={cls}
    >
      {inner}
    </a>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Menu,
  X,
  ChevronDown,
  Heart,
  Bell,
  UserRound,
  MessageSquare,
  TicketCheck,
  Phone,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { BrandLogo } from "@/components/layout/logo";
import { BookingStatusModal } from "@/components/booking/booking-status-modal";
import { getBookingIdsForUser } from "@/lib/bookings";
import { getHomestayBookingIdsForUser } from "@/lib/homestay-bookings";
import { getTourBookingIdsForUser } from "@/lib/tour-bookings";
import { getTransportBookingIdsForUser } from "@/lib/transport-bookings";
import { getGuideBookingIdsForUser } from "@/lib/guide-bookings";
import { getMediaBookingIdsForUser } from "@/lib/media-bookings";
import { getRestaurantBookingIdsForUser } from "@/lib/restaurant-bookings";
import { adminThreadId, getAdminThreads } from "@/lib/messages";
import { getMessagesForBookings, type MsgMeta } from "@/lib/messages";
import { useUnread } from "@/lib/use-unread";
import { useWishlist } from "@/lib/wishlist";
import { cn } from "@/lib/utils";

type NavNotif = { id: string; who: string; text: string; time: string };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

type NavChild = { label: string; href: string };
type NavLink = {
  label: string;
  href: string;
  align?: "left" | "right";
  children?: NavChild[];
};

const navLinks: NavLink[] = [
  { label: "Home", href: "/" },
  {
    label: "Services",
    href: "/listings",
    children: [
      { label: "Flights", href: "/flights" },
      { label: "Hotels & Resorts", href: "/categories/hotels" },
      { label: "Homestays", href: "/categories/homestays" },
      { label: "Hostels", href: "/categories/hostels" },
      { label: "Mountaineering & Expeditions", href: "/expeditions" },
      { label: "Travel Companies", href: "/categories/travel-companies" },
      { label: "Tour Packages", href: "/categories/tours" },
      { label: "Transport & Rentals", href: "/categories/transport" },
      { label: "Tour Guides", href: "/categories/guides" },
      { label: "Photographers & Videographers", href: "/categories/photographers" },
      { label: "Drone Camera Pilot", href: "/categories/drone-pilots" },
      { label: "Co-working Spaces", href: "/coworking" },
      { label: "Connect Solo Traveler", href: "/connect" },
      { label: "Restaurants", href: "/categories/restaurants" },
    ],
  },
  {
    label: "Activities",
    href: "/activities",
    children: [
      { label: "All Activities", href: "/activities" },
      { label: "Indoor Activities & Experiences", href: "/activities?kind=indoor" },
      { label: "Camping", href: "/activities?category=camping" },
      { label: "Trekking", href: "/activities?category=trekking" },
      { label: "Hiking", href: "/activities?category=hiking" },
      { label: "Jeep Safari", href: "/activities?category=jeep-safari" },
      { label: "Horse Riding", href: "/activities?category=horse-riding" },
      { label: "Fishing", href: "/activities?category=fishing" },
      { label: "Boating", href: "/activities?category=boating" },
      { label: "Cultural Tours", href: "/activities?category=cultural-tours" },
    ],
  },
  {
    label: "Roadside Assistance",
    href: "/roadside",
    children: [
      { label: "All Services", href: "/roadside" },
      { label: "Road Updates & Alerts", href: "/roadside/updates" },
      { label: "Bike Puncture Service", href: "/roadside/bike-puncture" },
      { label: "Car Puncture Service", href: "/roadside/car-puncture" },
      { label: "Battery Service", href: "/roadside/battery-service" },
      { label: "Fuel Delivery", href: "/roadside/fuel-delivery" },
      { label: "Vehicle Recovery", href: "/roadside/vehicle-recovery" },
    ],
  },
  {
    label: "Events & Expo",
    href: "/events",
    children: [
      { label: "All Events", href: "/events" },
      { label: "Festivals", href: "/events?category=festivals" },
      { label: "Tourism Events", href: "/events?category=tourism-events" },
      { label: "Local Expos", href: "/events?category=local-expos" },
      { label: "Adventure Events", href: "/events?category=adventure-events" },
      { label: "Cultural Events", href: "/events?category=cultural-events" },
    ],
  },
  { label: "Safarnama", href: "/safarnama" },
  { label: "Rego Map", href: "/map" },
  { label: "About Us", href: "/about" },
  {
    label: "Contact Us",
    href: "/contact",
    align: "right",
    children: [
      { label: "Contact Us", href: "/contact" },
      { label: "How It Works", href: "/how-it-works" },
    ],
  },
];

function isExternal(href: string) {
  return href.startsWith("http") || href.startsWith("mailto:");
}

/** Renders an internal <Link> or an external <a> depending on the href. */
function SmartLink({
  href,
  className,
  onClick,
  children,
}: {
  href: string;
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  if (isExternal(href)) {
    return (
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel="noopener noreferrer"
        className={className}
        onClick={onClick}
      >
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

function Logo() {
  return (
    <Link href="/" aria-label="Rego home" className="flex items-center">
      <BrandLogo className="h-16 w-auto" />
    </Link>
  );
}

export function Navbar({ fluid = true }: { fluid?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [openSections, setOpenSections] = React.useState<Set<string>>(new Set());
  const { user } = useAuth();
  const pathname = usePathname();
  // On full-width dashboards (e.g. Rego Map) the bar should span edge-to-edge
  // instead of being centered in the 1320px container.
  const cx = fluid ? "w-full px-5 sm:px-8" : "container-px";

  const accountHref = user
    ? user.role === "admin"
      ? "/admin"
      : "/dashboard"
    : "/signin";
  const initial = user?.name.trim().charAt(0).toUpperCase();

  const [bookingIds, setBookingIds] = React.useState<string[]>([]);
  React.useEffect(() => {
    if (!user) {
      setBookingIds([]);
      return;
    }
    let active = true;
    const loadIds = async () => {
      const [hotelIds, homestayIds, tourIds, transportIds, guideIds, mediaIds, restaurantIds] =
        await Promise.all([
          getBookingIdsForUser(user.email),
          getHomestayBookingIdsForUser(user.email),
          getTourBookingIdsForUser(user.email),
          getTransportBookingIdsForUser(user.email),
          getGuideBookingIdsForUser(user.email),
          getMediaBookingIdsForUser(user.email),
          getRestaurantBookingIdsForUser(user.email),
        ]);
      // Admins watch every admin↔owner thread; everyone else watches their own.
      const adminIds =
        user.role === "admin"
          ? (await getAdminThreads()).map((t) => t.threadId)
          : [adminThreadId(user.email)];
      if (!active) return;
      const next = [
        ...hotelIds,
        ...homestayIds,
        ...tourIds,
        ...transportIds,
        ...guideIds,
        ...mediaIds,
        ...restaurantIds,
        ...adminIds,
      ];
      // Only update when the set actually changes (avoids needless re-renders).
      setBookingIds((prev) =>
        prev.length === next.length && prev.every((id, i) => id === next[i])
          ? prev
          : next
      );
    };
    loadIds();
    // Re-poll so brand-new bookings reach the owner's alert list quickly.
    const t = setInterval(() => { if (document.visibilityState === "visible") loadIds(); }, 60000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [user]);
  const { unread } = useUnread(bookingIds, user?.email ?? "");
  const { count: wishCount } = useWishlist();

  // Notifications dropdown — latest message from the other party per booking.
  const router = useRouter();
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [notifs, setNotifs] = React.useState<NavNotif[]>([]);
  const [statusOpen, setStatusOpen] = React.useState(false);
  const idsKey = bookingIds.join(",");
  React.useEffect(() => {
    if (!user || bookingIds.length === 0) {
      setNotifs([]);
      return;
    }
    let active = true;
    const load = async () => {
      const meta = await getMessagesForBookings(idsKey.split(","));
      const byBooking = new Map<string, MsgMeta>();
      for (const m of meta) {
        if (m.sender_email === user.email) continue; // only others' messages
        const cur = byBooking.get(m.booking_id);
        if (!cur || new Date(m.created_at) > new Date(cur.created_at)) {
          byBooking.set(m.booking_id, m);
        }
      }
      const list = [...byBooking.values()]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 8)
        .map((m) => ({
          id: m.booking_id,
          who: m.sender_name ?? m.sender_email,
          text: m.text ?? "",
          time: m.created_at,
        }));
      if (active) setNotifs(list);
    };
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 30000);
    return () => {
      active = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, idsKey]);

  const openNotif = (bookingId: string) => {
    try {
      // Read on arrival when navigating in from another page.
      localStorage.setItem("safarigb_open_chat", bookingId);
      // Open instantly when the dashboard is already mounted (no reload).
      window.dispatchEvent(
        new CustomEvent("safarigb:open-chat", { detail: bookingId })
      );
    } catch {
      /* ignore */
    }
    setNotifOpen(false);
    router.push(accountHref);
  };

  // Close the mobile menu whenever the route changes.
  React.useEffect(() => {
    setOpen(false);
    setOpenSections(new Set());
  }, [pathname]);

  const toggleSection = (label: string) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  const isActive = (link: NavLink) =>
    link.href === "/"
      ? pathname === "/"
      : pathname === link.href ||
        (link.children?.some((c) => pathname === c.href.split("#")[0]) ?? false);

  return (
    <header className="sticky top-0 z-50 shadow-premium">
      {/* Desktop utility bar (white) — helpline + currency / wishlist / booking status / notifications */}
      <div className="hidden border-b border-border bg-white xl:block">
        <div className={cn(cx, "flex h-10 items-center justify-between")}>
          <a
            href="tel:+923161290604"
            className="flex items-center gap-1.5 text-sm font-semibold text-forest transition-colors hover:text-forest-600"
          >
            <Phone className="h-4 w-4 text-forest-600" /> Helpline: +92 316 1290604
          </a>
          <div className="flex items-center gap-5">
            <button className="flex items-center gap-1 text-sm font-medium text-forest transition-colors hover:text-forest-600">
              PKR <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <Link
              href="/wishlist"
              aria-label="Wishlist"
              className="relative text-forest/80 transition-colors hover:text-forest-600"
            >
              <Heart className="h-5 w-5" />
              {wishCount > 0 && (
                <span className="absolute -right-2 -top-2 grid h-4 min-w-[16px] place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-forest-900">
                  {wishCount}
                </span>
              )}
            </Link>
            <button
              onClick={() => setStatusOpen(true)}
              aria-label="Booking status"
              title="Check booking status"
              className="flex items-center text-forest/80 transition-colors hover:text-forest-600"
            >
              <TicketCheck className="h-5 w-5" />
            </button>
            <div className="relative flex items-center">
              {user ? (
                <button
                  onClick={() => setNotifOpen((v) => !v)}
                  aria-label="Notifications"
                  className="relative flex items-center text-forest/80 transition-colors hover:text-forest-600"
                >
                  <Bell className="h-5 w-5" />
                  {unread.size > 0 && (
                    <span className="absolute -right-2 -top-2 grid h-4 min-w-[16px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {unread.size}
                    </span>
                  )}
                </button>
              ) : (
                <Link
                  href="/signin"
                  aria-label="Notifications"
                  className="relative block text-forest/80 transition-colors hover:text-forest-600"
                >
                  <Bell className="h-5 w-5" />
                </Link>
              )}

              {user && notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-full z-50 mt-3 w-80 overflow-hidden rounded-2xl border border-border/70 bg-white text-left shadow-premium-lg">
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                      <p className="font-display text-sm font-bold text-forest">Notifications</p>
                      {unread.size > 0 && (
                        <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                          {unread.size} new
                        </span>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifs.length === 0 ? (
                        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                          No messages yet.
                        </p>
                      ) : (
                        notifs.map((n) => {
                          const isUnread = unread.has(n.id);
                          return (
                            <button
                              key={n.id}
                              onClick={() => openNotif(n.id)}
                              className={cn(
                                "flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/50",
                                isUnread && "bg-forest-50/40"
                              )}
                            >
                              <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest-50 text-forest-600">
                                <MessageSquare className="h-4 w-4" />
                                {isUnread && (
                                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="flex items-center justify-between gap-2">
                                  <span
                                    className={cn(
                                      "truncate text-sm font-semibold text-forest",
                                      isUnread && "font-bold"
                                    )}
                                  >
                                    {n.who}
                                  </span>
                                  <span className="shrink-0 text-[10px] text-muted-foreground">
                                    {timeAgo(n.time)}
                                  </span>
                                </span>
                                <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">
                                  {n.text}
                                </span>
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                    <Link
                      href={accountHref}
                      onClick={() => setNotifOpen(false)}
                      className="block border-t border-border px-4 py-2.5 text-center text-xs font-semibold text-forest-600 hover:bg-muted/50"
                    >
                      View all in dashboard
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Full-width green bar; nav content stays within the container.
         Solid forest-800 so it exactly matches the footer background. */}
      <div className="border-b border-white/10 bg-forest-800">
      <nav className={cn("relative flex h-20 items-center justify-between gap-2", cx)}>
        {/* Desktop: logo on the left */}
        <div className="hidden xl:flex">
          <Logo />
        </div>

        {/* Mobile: account / login icon on the left (where the logo used to sit) */}
        <Link
          href={accountHref}
          aria-label={user ? "My account" : "Sign in or create account"}
          title={user ? user.name : "Sign in / Sign up"}
          className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-full bg-gradient-gold font-display text-sm font-bold text-forest-900 shadow-gold-glow transition-transform active:scale-95 xl:hidden"
        >
          {user?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            initial ?? <UserRound className="h-5 w-5" />
          )}
          {user && unread.size > 0 && (
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-forest-900 bg-red-500" />
          )}
        </Link>

        {/* Mobile: centered logo */}
        <Link
          href="/"
          aria-label="Rego home"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 xl:hidden"
        >
          <BrandLogo className="h-14 w-auto" />
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-0.5 xl:flex">
          {navLinks.map((link) =>
            link.children ? (
              <div key={link.label} className="group relative">
                <Link
                  href={link.href}
                  className={cn(
                    "flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium uppercase tracking-wide text-white/90 transition-colors hover:text-gold",
                    isActive(link) && "text-gold"
                  )}
                >
                  {link.label}
                  <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
                </Link>
                <div
                  className={cn(
                    "invisible absolute top-full z-50 min-w-[240px] translate-y-2 rounded-2xl border border-border/70 bg-white/95 p-2 opacity-0 shadow-premium-lg backdrop-blur-xl transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100",
                    link.align === "right" ? "right-0" : "left-0"
                  )}
                >
                  {link.children.map((c) => (
                    <SmartLink
                      key={c.label}
                      href={c.href}
                      className="block rounded-lg px-3 py-2 text-sm font-medium text-forest transition-colors hover:bg-forest-50 hover:text-forest-600"
                    >
                      {c.label}
                    </SmartLink>
                  ))}
                </div>
              </div>
            ) : (
              <Link
                key={link.label}
                href={link.href}
                className={cn(
                  "flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-2 text-sm font-medium uppercase tracking-wide text-white/90 transition-colors hover:text-gold",
                  isActive(link) && "text-gold"
                )}
              >
                {link.label}
              </Link>
            )
          )}
        </div>

        {/* Right cluster (desktop): account avatar only — utilities live in the white top bar */}
        <div className="hidden items-center gap-4 xl:flex">
          <Link
            href={accountHref}
            aria-label={user ? "Dashboard" : "Sign in"}
            title={user ? user.name : "Sign in"}
            className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-gradient-gold font-display text-sm font-bold text-forest-900 shadow-gold-glow transition-transform hover:scale-105"
          >
            {user?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              initial ?? <UserRound className="h-5 w-5" />
            )}
          </Link>
        </div>

        {/* Mobile: hamburger stays on the right */}
        <button
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="grid h-11 w-11 place-items-center rounded-full text-white transition-colors hover:bg-white/10 xl:hidden"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden border-t border-white/10 bg-gradient-forest-deep xl:hidden"
          >
            <div className="container-px max-h-[70vh] overflow-y-auto py-4">
              <div className="flex flex-col gap-1">
                {navLinks.map((link) =>
                  link.children ? (
                    <div key={link.label} className="rounded-lg">
                      <button
                        onClick={() => toggleSection(link.label)}
                        className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium uppercase tracking-wide text-white/90 hover:bg-white/5 hover:text-gold"
                      >
                        {link.label}
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 transition-transform",
                            openSections.has(link.label) && "rotate-180"
                          )}
                        />
                      </button>
                      <AnimatePresence initial={false}>
                        {openSections.has(link.label) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div className="ml-3 flex flex-col gap-0.5 border-l border-white/10 pl-3 pb-2">
                              {link.children.map((c) => (
                                <SmartLink
                                  key={c.label}
                                  href={c.href}
                                  onClick={() => setOpen(false)}
                                  className="rounded-md px-4 py-2.5 text-sm font-medium text-white/75 hover:bg-white/5 hover:text-gold"
                                >
                                  {c.label}
                                </SmartLink>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <Link
                      key={link.label}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="rounded-lg px-4 py-3 text-sm font-medium uppercase tracking-wide text-white/90 hover:bg-white/5 hover:text-gold"
                    >
                      {link.label}
                    </Link>
                  )
                )}
              </div>

              <Link
                href={accountHref}
                onClick={() => setOpen(false)}
                className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-3 font-semibold text-forest-900 shadow-gold-glow"
              >
                <UserRound className="h-5 w-5" />
                {user ? "My Dashboard" : "Sign in / Create account"}
              </Link>
              {!user && (
                <Link
                  href="/signup"
                  onClick={() => setOpen(false)}
                  className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-3 font-semibold text-white hover:bg-white/5"
                >
                  Become a Partner
                </Link>
              )}
              <button
                onClick={() => {
                  setStatusOpen(true);
                  setOpen(false);
                }}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 px-4 py-3 font-semibold text-white hover:bg-white/5"
              >
                <TicketCheck className="h-5 w-5" /> Booking status
              </button>
              <div className="flex items-center gap-4 px-4 py-3">
                <span className="text-sm font-medium text-white/90">PKR</span>
                <Link
                  href="/wishlist"
                  onClick={() => setOpen(false)}
                  aria-label="Wishlist"
                  className="relative text-white/90 hover:text-gold"
                >
                  <Heart className="h-5 w-5" />
                  {wishCount > 0 && (
                    <span className="absolute -right-2 -top-2 grid h-4 min-w-[16px] place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-forest-900">
                      {wishCount}
                    </span>
                  )}
                </Link>
                <Bell className="h-5 w-5 text-white/90" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {statusOpen && <BookingStatusModal onClose={() => setStatusOpen(false)} />}
    </header>
  );
}

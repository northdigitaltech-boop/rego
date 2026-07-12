"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarCheck,
  Heart,
  UserRound,
  Star,
  Wallet,
  LogOut,
  MessageSquare,
  Trash2,
  LifeBuoy,
} from "lucide-react";

import { getCategory } from "@/lib/data";
import { useWishlist } from "@/lib/wishlist";
import { useAuth } from "@/components/auth/auth-context";
import { PartnerDashboard } from "@/components/dashboard/partner-dashboard";
import { HotelProviderDashboard } from "@/components/dashboard/hotel-provider-dashboard";
import { HomestayProviderDashboard } from "@/components/dashboard/homestay-provider-dashboard";
import { HostelProviderDashboard } from "@/components/dashboard/hostel-provider-dashboard";
import { TourCompanyDashboard } from "@/components/dashboard/tour-company-dashboard";
import { TransportProviderDashboard } from "@/components/dashboard/transport-provider-dashboard";
import { GuideDashboard } from "@/components/dashboard/guide-dashboard";
import { MediaDashboard } from "@/components/dashboard/media-dashboard";
import { RestaurantDashboard } from "@/components/dashboard/restaurant-dashboard";
import { RoadsideProviderDashboard } from "@/components/dashboard/roadside-provider-dashboard";
import { CoworkingProviderDashboard } from "@/components/dashboard/coworking-provider-dashboard";
import { ActivityProviderDashboard } from "@/components/dashboard/activity-provider-dashboard";
import { ExpeditionDashboard } from "@/components/dashboard/expedition-dashboard";
import {
  getBookingsByCustomer,
  bookingRef,
  type BookingRow as DbBooking,
} from "@/lib/bookings";
import { getHomestayBookingsByCustomer } from "@/lib/homestay-bookings";
import { getHostelBookingsByCustomer } from "@/lib/hostel-bookings";
import { getTourBookingsByCustomer } from "@/lib/tour-bookings";
import { getTransportBookingsByCustomer } from "@/lib/transport-bookings";
import { getGuideBookingsByCustomer } from "@/lib/guide-bookings";
import { getMediaBookingsByCustomer } from "@/lib/media-bookings";
import { getRestaurantBookingsByCustomer } from "@/lib/restaurant-bookings";
import { ChatModal } from "@/components/chat/chat-modal";
import { MessagesInbox } from "@/components/chat/messages-inbox";
import { AvatarUpload } from "@/components/ui/image-upload";
import { AccountSecurity } from "@/components/account/account-security";
import { RoadsideMyRequests } from "@/components/roadside/my-requests";
import { useUnread } from "@/lib/use-unread";
import { cn, formatPrice, photo } from "@/lib/utils";

type Tab = "overview" | "bookings" | "roadside" | "messages" | "wishlist" | "profile";

const nav: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "bookings", label: "My Bookings", icon: CalendarCheck },
  { id: "roadside", label: "Roadside Requests", icon: LifeBuoy },
  { id: "messages", label: "Messages", icon: MessageSquare },
  { id: "wishlist", label: "Wishlist", icon: Heart },
  { id: "profile", label: "Profile", icon: UserRound },
];


export function Dashboard() {
  const [tab, setTab] = React.useState<Tab>("overview");
  const [myBookings, setMyBookings] = React.useState<DbBooking[]>([]);
  const [chatBooking, setChatBooking] = React.useState<DbBooking | null>(null);
  const { user, ready, logout } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (ready && !user) router.replace("/signin");
    else if (ready && user?.role === "admin") router.replace("/admin");
  }, [ready, user, router]);

  React.useEffect(() => {
    if (user && user.role === "traveler") {
      Promise.all([
        getBookingsByCustomer(user.email),
        getHomestayBookingsByCustomer(user.email),
        getHostelBookingsByCustomer(user.email),
        getTourBookingsByCustomer(user.email),
        getTransportBookingsByCustomer(user.email),
        getGuideBookingsByCustomer(user.email),
        getMediaBookingsByCustomer(user.email),
        getRestaurantBookingsByCustomer(user.email),
      ]).then(([hotelBookings, homestayBookings, hostelBookings, tourBookings, transportBookings, guideBookings, mediaBookings, restaurantBookings]) => {
        // Adapt homestay + hostel + tour bookings into the shared booking shape.
        const adaptedHs: DbBooking[] = homestayBookings.map((b) => ({
          ...b,
          hotel_id: b.homestay_id,
          hotel_title: b.homestay_title,
        }));
        const adaptedHostel: DbBooking[] = hostelBookings.map((b) => ({
          ...b,
          hotel_id: b.hostel_id,
          hotel_title: b.hostel_title,
        }));
        const adaptedTour: DbBooking[] = tourBookings.map(
          (b) =>
            ({
              ...b,
              hotel_id: b.company_id,
              hotel_title: b.item_title,
              room_name: b.item_type,
              check_in: b.start_date,
              check_out: b.end_date,
              rooms: 1,
            }) as unknown as DbBooking
        );
        const adaptedTransport: DbBooking[] = transportBookings.map(
          (b) =>
            ({
              ...b,
              hotel_id: b.provider_id,
              hotel_title: b.item_title,
              room_name:
                b.listing_type === "rental" ? "Vehicle Rental" : "Transport Service",
              check_in: b.start_date,
              check_out: b.end_date,
              rooms: 1,
            }) as unknown as DbBooking
        );
        const adaptedGuide: DbBooking[] = guideBookings.map(
          (b) =>
            ({
              ...b,
              hotel_id: b.guide_id,
              hotel_title: b.item_title,
              room_name: b.service_title ?? "Tour Guide",
              check_in: b.start_date,
              check_out: b.end_date,
              rooms: 1,
            }) as unknown as DbBooking
        );
        const adaptedMedia: DbBooking[] = mediaBookings.map(
          (b) =>
            ({
              ...b,
              hotel_id: b.provider_id,
              hotel_title: b.item_title,
              room_name: b.service_title ?? "Media shoot",
              check_in: b.start_date,
              check_out: b.end_date,
              rooms: 1,
            }) as unknown as DbBooking
        );
        const adaptedRestaurant: DbBooking[] = restaurantBookings.map(
          (b) =>
            ({
              ...b,
              hotel_id: b.restaurant_id,
              hotel_title: b.item_title,
              room_name: b.booking_type === "inquiry" ? "Food inquiry" : "Table booking",
              check_in: b.date,
              check_out: null,
              rooms: 1,
              total_price: 0,
            }) as unknown as DbBooking
        );
        const all = [
          ...hotelBookings,
          ...adaptedHs,
          ...adaptedHostel,
          ...adaptedTour,
          ...adaptedTransport,
          ...adaptedGuide,
          ...adaptedMedia,
          ...adaptedRestaurant,
        ].sort(
          (a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")
        );
        setMyBookings(all);
      });
    }
  }, [user]);

  const { unread, markSeen } = useUnread(
    myBookings.map((b) => b.id),
    user?.email ?? "",
    { sound: false }
  );

  const openChat = (b: DbBooking) => {
    markSeen(b.id);
    setChatBooking(b);
  };

  // Open a specific chat from a navbar notification — instantly if already on
  // this page (event), or on arrival from another page (localStorage).
  React.useEffect(() => {
    const tryOpen = (id: string | null) => {
      if (!id) return;
      const b = myBookings.find((x) => x.id === id);
      if (b) {
        try {
          localStorage.removeItem("safarigb_open_chat");
        } catch {
          /* ignore */
        }
        openChat(b);
      }
    };
    try {
      tryOpen(localStorage.getItem("safarigb_open_chat"));
    } catch {
      /* ignore */
    }
    const handler = (e: Event) =>
      tryOpen((e as CustomEvent<string>).detail);
    window.addEventListener("safarigb:open-chat", handler);
    return () => window.removeEventListener("safarigb:open-chat", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myBookings]);

  if (!ready || !user) {
    return (
      <div className="container-px py-24 text-center text-muted-foreground">
        Loading your dashboard…
      </div>
    );
  }

  const firstName = user.name.split(" ")[0];

  const handleSignOut = () => {
    logout();
    router.push("/");
  };

  if (user.role === "partner") {
    if (user.businessCategory === "hotels") {
      return <HotelProviderDashboard user={user} onSignOut={handleSignOut} />;
    }
    if (user.businessCategory === "homestays") {
      return <HomestayProviderDashboard user={user} onSignOut={handleSignOut} />;
    }
    if (user.businessCategory === "hostels") {
      return <HostelProviderDashboard user={user} onSignOut={handleSignOut} />;
    }
    if (
      user.businessCategory === "travel-companies" ||
      user.businessCategory === "tours"
    ) {
      return <TourCompanyDashboard user={user} onSignOut={handleSignOut} />;
    }
    if (user.businessCategory === "transport") {
      return <TransportProviderDashboard user={user} onSignOut={handleSignOut} />;
    }
    if (user.businessCategory === "guides") {
      return <GuideDashboard user={user} onSignOut={handleSignOut} />;
    }
    if (
      user.businessCategory === "photographers" ||
      user.businessCategory === "drone-pilots"
    ) {
      return <MediaDashboard user={user} onSignOut={handleSignOut} />;
    }
    if (user.businessCategory === "restaurants") {
      return <RestaurantDashboard user={user} onSignOut={handleSignOut} />;
    }
    if (user.businessCategory === "roadside") {
      return <RoadsideProviderDashboard user={user} onSignOut={handleSignOut} />;
    }
    if (user.businessCategory === "coworking") {
      return <CoworkingProviderDashboard user={user} onSignOut={handleSignOut} />;
    }
    if (user.businessCategory === "activities") {
      return <ActivityProviderDashboard user={user} onSignOut={handleSignOut} />;
    }
    if (user.businessCategory === "mountaineering") {
      return <ExpeditionDashboard user={user} onSignOut={handleSignOut} />;
    }
    return <PartnerDashboard user={user} onSignOut={handleSignOut} />;
  }

  return (
    <div className="container-px py-10">
      <h1 className="font-display text-3xl font-bold text-forest">
        Welcome back, {firstName}
      </h1>
      <p className="mt-1 text-muted-foreground">
        Manage your bookings, wishlist and profile.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        {/* Sidebar */}
        <aside>
          <div className="sticky top-24 rounded-3xl border border-border/70 bg-card p-3 shadow-premium">
            <div className="flex items-center gap-3 border-b border-border p-3">
              <span className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-gold text-forest-900">
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatar}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserRound className="h-6 w-6" />
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-forest">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email}
                </p>
                <span className="mt-1 inline-block rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold-700">
                  {user.role === "partner"
                    ? getCategory(user.businessCategory ?? "")?.name ?? "Partner"
                    : "Traveler"}
                </span>
              </div>
            </div>
            <nav className="mt-2 space-y-1">
              {nav.map((n) => {
                const Icon = n.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => setTab(n.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      tab === n.id
                        ? "bg-gradient-forest text-white shadow-soft"
                        : "text-forest hover:bg-muted"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {n.label}
                    {n.id === "messages" && unread.size > 0 && (
                      <span className="ml-auto h-2 w-2 rounded-full bg-red-500" />
                    )}
                  </button>
                );
              })}
              <button
                onClick={handleSignOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-forest hover:bg-muted"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </nav>
          </div>
        </aside>

        {/* Content */}
        <div>
          {tab === "overview" && (
            <Overview bookings={myBookings} onChat={openChat} unread={unread} />
          )}
          {tab === "bookings" && (
            <Bookings bookings={myBookings} onChat={openChat} unread={unread} />
          )}
          {tab === "messages" && (
            <MessagesInbox
              bookings={myBookings}
              unread={unread}
              otherLabelFor={(b) => b.hotel_title}
              onOpen={openChat}
            />
          )}
          {tab === "roadside" && <RoadsideMyRequests />}
          {tab === "wishlist" && <Wishlist />}
          {tab === "profile" && <Profile />}
        </div>
      </div>

      {chatBooking && (
        <ChatModal
          booking={chatBooking}
          currentEmail={user.email}
          currentName={user.name}
          currentAvatar={user.avatar}
          otherLabel={chatBooking.hotel_title}
          onSeen={() => markSeen(chatBooking.id)}
          onClose={() => setChatBooking(null)}
        />
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-premium">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-forest-50 text-forest-600">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 font-display text-2xl font-bold text-forest">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function Overview({
  bookings,
  onChat,
  unread,
}: {
  bookings: DbBooking[];
  onChat: (b: DbBooking) => void;
  unread: Set<string>;
}) {
  const spent = bookings
    .filter((b) => b.status === "accepted")
    .reduce((s, b) => s + b.total_price, 0);
  const { count: wishCount } = useWishlist();
  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard
          icon={CalendarCheck}
          label="Total bookings"
          value={String(bookings.length)}
        />
        <StatCard
          icon={Heart}
          label="Saved listings"
          value={String(wishCount)}
        />
        <StatCard icon={Wallet} label="Total spent" value={formatPrice(spent)} />
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-premium">
        <h2 className="font-display text-lg font-bold text-forest">
          Recent booking
        </h2>
        {bookings.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No bookings yet — explore hotels and book your first stay.
          </p>
        ) : (
          <div className="mt-2">
            <BookingItem
              b={bookings[0]}
              onChat={onChat}
              unread={unread.has(bookings[0].id)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Bookings({
  bookings,
  onChat,
  unread,
}: {
  bookings: DbBooking[];
  onChat: (b: DbBooking) => void;
  unread: Set<string>;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-premium">
      <h2 className="font-display text-lg font-bold text-forest">My bookings</h2>
      {bookings.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          You haven&apos;t booked anything yet. Find a hotel and hit “Book Now”.
        </p>
      ) : (
        <div className="mt-4 divide-y divide-border">
          {bookings.map((b) => (
            <BookingItem
              key={b.id}
              b={b}
              onChat={onChat}
              unread={unread.has(b.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BookingItem({
  b,
  onChat,
  unread,
}: {
  b: DbBooking;
  onChat: (b: DbBooking) => void;
  unread: boolean;
}) {
  const meta =
    b.status === "accepted"
      ? { label: "Confirmed", cls: "bg-forest-50 text-forest-600" }
      : b.status === "rejected"
        ? { label: "Rejected", cls: "bg-red-50 text-red-600" }
        : { label: "Pending", cls: "bg-gold/20 text-gold-700" };
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <Link
          href={b.hotel_id ? `/listings/${b.hotel_id}` : "#"}
          className="font-semibold text-forest hover:text-gold"
        >
          {b.hotel_title}
          {b.room_name ? ` · ${b.room_name}` : ""}
        </Link>
        <p className="font-display text-xs font-bold tracking-wider text-forest-600">
          {bookingRef(b.id)}
        </p>
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <CalendarCheck className="h-3.5 w-3.5" />
          {b.check_in ?? "—"}
          {b.check_out ? ` → ${b.check_out}` : ""}
          {(b.rooms ?? 0) > 1 ? ` · ${b.rooms} rooms` : ""}
          {b.guests ? ` · ${b.guests} guest${b.guests > 1 ? "s" : ""}` : ""}
        </p>
        {(b.total_price ?? 0) > 0 && (
          <p className="mt-0.5 text-sm font-semibold text-forest">
            {formatPrice(b.total_price)}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            meta.cls
          )}
        >
          {meta.label}
        </span>
        <button
          onClick={() => onChat(b)}
          className={cn(
            "relative flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
            unread
              ? "border-red-300 bg-red-50 text-red-600"
              : "border-border text-forest hover:bg-muted"
          )}
        >
          <MessageSquare className="h-3.5 w-3.5" /> Message
          {unread && (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" />
          )}
        </button>
      </div>
    </div>
  );
}

function Wishlist() {
  const { items, remove } = useWishlist();
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 py-16 text-center">
        <Heart className="mx-auto h-10 w-10 text-forest-600" />
        <p className="mt-2 font-display text-lg font-semibold text-forest">
          No saved items yet
        </p>
        <p className="text-sm text-muted-foreground">
          Tap the heart on any listing to save it here.
        </p>
      </div>
    );
  }
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {items.map((l) => (
        <div
          key={l.id}
          className="group relative flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-premium transition-shadow hover:shadow-card"
        >
          <Link
            href={`/listings/${l.id}`}
            className="absolute inset-0"
            aria-label={l.title}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo(l.image)}
            alt={l.title}
            className="h-20 w-20 shrink-0 rounded-xl object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-forest group-hover:text-gold">
              {l.title}
            </p>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-gold text-gold" /> {l.rating} ·{" "}
              {l.location}
            </p>
            <p className="mt-1 font-display font-bold text-forest">
              {formatPrice(l.price)}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                / {l.unit}
              </span>
            </p>
          </div>
          <button
            onClick={() => remove(l.id)}
            aria-label="Remove from wishlist"
            className="relative z-10 self-start text-muted-foreground hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function Profile() {
  const { user, updateProfile } = useAuth();
  const [name, setName] = React.useState(user?.name ?? "");
  const [saved, setSaved] = React.useState(false);
  if (!user) return null;
  return (
    <>
    <div className="rounded-2xl border border-border bg-card p-6 shadow-premium">
      <h2 className="font-display text-lg font-bold text-forest">
        Profile details
      </h2>

      <div className="mt-5 flex items-center gap-4">
        <AvatarUpload
          value={user.avatar ?? ""}
          onChange={(url) => updateProfile({ avatar: url })}
        />
        <div>
          <p className="font-semibold text-forest">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tap the photo to upload a profile picture
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateProfile({ name });
          setSaved(true);
        }}
        className="mt-5 grid gap-4 sm:grid-cols-2"
      >
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-forest">
            Full name
          </span>
          <input
            className="auth-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-forest">
            Email
          </span>
          <input className="auth-input" defaultValue={user.email} readOnly />
        </label>
        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            className="rounded-lg bg-forest-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-forest-700"
          >
            Save changes
          </button>
          {saved && (
            <span className="text-sm font-medium text-forest-600">Saved ✓</span>
          )}
        </div>
      </form>
    </div>
    <AccountSecurity />
    </>
  );
}

import { getBookingIdsForUser } from "@/lib/bookings";
import { getHomestayBookingIdsForUser } from "@/lib/homestay-bookings";
import { getTourBookingIdsForUser } from "@/lib/tour-bookings";
import { getTransportBookingIdsForUser } from "@/lib/transport-bookings";
import { getGuideBookingIdsForUser } from "@/lib/guide-bookings";
import { getMediaBookingIdsForUser } from "@/lib/media-bookings";
import { getRestaurantBookingIdsForUser } from "@/lib/restaurant-bookings";
import { adminThreadId, getAdminThreads, getMessagesForBookings } from "@/lib/messages";
import { getNotifications } from "@/lib/notifications";

/* ============================================================
 * Everything the navbar's alert badges need, in one module that
 * the navbar loads LAZILY.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE EXISTS
 *
 * The navbar statically imported seven booking libraries plus
 * messages, notifications, booking-lookup and cancellation. Measured
 * against the homepage's client bundle, the navbar and what only it
 * pulls in came to 144 KB — 36% of 402 KB.
 *
 * None of it does anything for a signed-out visitor. All three effects
 * that use it begin `if (!user) return`. But a static import is in the
 * chunk whether it runs or not, so every first-time visitor, every
 * search-engine crawler and every Lighthouse run downloaded and parsed
 * seven booking libraries in order for them to do nothing.
 *
 * That cost lands hardest exactly where the score was worst: mobile
 * Lighthouse throttles the CPU 4x, which is why desktop sat at 86 and
 * mobile at 74. Parsing and compiling JavaScript is most of that gap.
 *
 * Collecting them behind one module means the navbar can `await
 * import()` it inside those guarded effects. The code then loads only
 * for people who are signed in, and only after hydration — off the
 * critical path entirely.
 *
 * ---------------------------------------------------------------------------
 * WHAT DID NOT MOVE, AND WHY
 *
 * The navbar's COMPONENTS — MobileBottomNavigation, RecommendationsBell,
 * BookingStatusModal — render unconditionally, not behind a `user`
 * check. Deferring those would shift layout on first paint, which
 * trades a TBT win for a CLS loss. They stay.
 * ============================================================ */

/**
 * Every booking thread this person should watch.
 *
 * Identical to what the navbar did inline: seven booking tables in
 * parallel, then the admin threads — all of them for an admin, their
 * own otherwise.
 */
export async function fetchWatchedBookingIds(
  email: string,
  isAdmin: boolean
): Promise<string[]> {
  const [hotelIds, homestayIds, tourIds, transportIds, guideIds, mediaIds, restaurantIds] =
    await Promise.all([
      getBookingIdsForUser(email),
      getHomestayBookingIdsForUser(email),
      getTourBookingIdsForUser(email),
      getTransportBookingIdsForUser(email),
      getGuideBookingIdsForUser(email),
      getMediaBookingIdsForUser(email),
      getRestaurantBookingIdsForUser(email),
    ]);

  const adminIds = isAdmin
    ? (await getAdminThreads()).map((t) => t.threadId)
    : [adminThreadId(email)];

  return [
    ...hotelIds,
    ...homestayIds,
    ...tourIds,
    ...transportIds,
    ...guideIds,
    ...mediaIds,
    ...restaurantIds,
    ...adminIds,
  ];
}

export interface NavNotif {
  id: string;
  who: string;
  text: string;
  time: string;
}

/**
 * The latest message from the OTHER party on each booking, newest
 * first, capped at eight — the shape the dropdown renders.
 */
export async function fetchLatestMessages(
  bookingIds: string[],
  selfEmail: string
): Promise<NavNotif[]> {
  const meta = await getMessagesForBookings(bookingIds);
  const byBooking = new Map<string, (typeof meta)[number]>();

  for (const m of meta) {
    if (m.sender_email === selfEmail) continue; // only others' messages
    const cur = byBooking.get(m.booking_id);
    if (!cur || new Date(m.created_at) > new Date(cur.created_at)) {
      byBooking.set(m.booking_id, m);
    }
  }

  return [...byBooking.values()]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8)
    .map((m) => ({
      id: m.booking_id,
      who: m.sender_name ?? m.sender_email,
      text: m.text ?? "",
      time: m.created_at,
    }));
}

/** Admin / recommendation notifications. */
export async function fetchNotifications(email: string) {
  return getNotifications(email, 15);
}

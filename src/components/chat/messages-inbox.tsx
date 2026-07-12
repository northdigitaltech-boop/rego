"use client";

import * as React from "react";
import { MessageSquare, ChevronRight } from "lucide-react";

import { getMessagesForBookings, type MsgMeta } from "@/lib/messages";
import { subscribeToMessages } from "@/lib/realtime";
import { usePoll } from "@/lib/use-poll";
import { bookingRef, type BookingRow } from "@/lib/bookings";
import { cn } from "@/lib/utils";

export function MessagesInbox({
  bookings,
  unread,
  otherLabelFor,
  onOpen,
}: {
  bookings: BookingRow[];
  unread: Set<string>;
  otherLabelFor: (b: BookingRow) => string;
  onOpen: (b: BookingRow) => void;
}) {
  const [meta, setMeta] = React.useState<MsgMeta[]>([]);
  const idsKey = bookings.map((b) => b.id).join(",");

  const load = React.useCallback(async () => {
    const ids = idsKey ? idsKey.split(",") : [];
    const m = await getMessagesForBookings(ids);
    setMeta(m);
  }, [idsKey]);

  React.useEffect(() => {
    load();
  }, [load]);

  // Long safety-net poll (paused when tab hidden); Realtime carries updates.
  usePoll(load, 60000);

  // Realtime: fold new messages straight into the previews, no DB round-trip.
  React.useEffect(() => {
    const ids = new Set(idsKey ? idsKey.split(",") : []);
    const unsub = subscribeToMessages((m) => {
      if (!ids.has(m.booking_id)) return;
      setMeta((prev) => [
        ...prev,
        {
          booking_id: m.booking_id,
          sender_email: m.sender_email,
          sender_name: m.sender_name,
          text: m.text,
          created_at: m.created_at,
        },
      ]);
    });
    return unsub;
  }, [idsKey]);

  // Latest message per booking
  const lastByBooking = new Map<string, MsgMeta>();
  for (const m of meta) {
    const cur = lastByBooking.get(m.booking_id);
    if (!cur || new Date(m.created_at) > new Date(cur.created_at)) {
      lastByBooking.set(m.booking_id, m);
    }
  }

  // Sort: bookings with most recent message first
  const sorted = [...bookings].sort((a, b) => {
    const ta = lastByBooking.get(a.id)?.created_at ?? "";
    const tb = lastByBooking.get(b.id)?.created_at ?? "";
    return tb.localeCompare(ta);
  });

  if (bookings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/40 py-16 text-center">
        <MessageSquare className="mx-auto h-10 w-10 text-forest-600" />
        <p className="mt-2 font-display text-lg font-semibold text-forest">
          No conversations yet
        </p>
        <p className="text-sm text-muted-foreground">
          Messages from your bookings will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      {sorted.map((b) => {
        const last = lastByBooking.get(b.id);
        const isUnread = unread.has(b.id);
        return (
          <button
            key={b.id}
            onClick={() => onOpen(b)}
            className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/50"
          >
            <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-forest-50 text-forest-600">
              <MessageSquare className="h-5 w-5" />
              {isUnread && (
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-500" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p
                  className={cn(
                    "truncate font-semibold text-forest",
                    isUnread && "font-bold"
                  )}
                >
                  {otherLabelFor(b)}
                </p>
                <span className="shrink-0 text-[10px] font-bold tracking-wider text-forest-600">
                  {bookingRef(b.id)}
                </span>
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {last?.text ?? b.hotel_title}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        );
      })}
    </div>
  );
}

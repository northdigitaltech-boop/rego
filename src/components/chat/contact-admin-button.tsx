"use client";

import * as React from "react";
import { Headset } from "lucide-react";

import { ChatModal } from "@/components/chat/chat-modal";
import { useUnread } from "@/lib/use-unread";
import { adminThreadId } from "@/lib/messages";
import { type BookingRow } from "@/lib/bookings";
import { cn } from "@/lib/utils";

/**
 * Lets an owner/provider message the Rego admin (support). Uses a stable
 * "admin::<ownerEmail>" thread on the shared messages table, so it reuses the
 * same chat + unread + sound system. Also opens when the matching navbar
 * notification is clicked.
 */
export function ContactAdminButton({
  ownerEmail,
  ownerName,
  ownerAvatar,
}: {
  ownerEmail: string;
  ownerName: string;
  ownerAvatar?: string | null;
}) {
  const threadId = adminThreadId(ownerEmail);
  const [open, setOpen] = React.useState(false);
  const { unread, markSeen } = useUnread([threadId], ownerEmail, { sound: false });
  const hasUnread = unread.has(threadId);

  // Open from a navbar notification click (event now, localStorage on arrival).
  React.useEffect(() => {
    const tryOpen = (id: string | null) => {
      if (id && id === threadId) {
        try {
          localStorage.removeItem("safarigb_open_chat");
        } catch {
          /* ignore */
        }
        setOpen(true);
      }
    };
    try {
      tryOpen(localStorage.getItem("safarigb_open_chat"));
    } catch {
      /* ignore */
    }
    const handler = (e: Event) => tryOpen((e as CustomEvent<string>).detail);
    window.addEventListener("safarigb:open-chat", handler);
    return () => window.removeEventListener("safarigb:open-chat", handler);
  }, [threadId]);

  const booking = {
    id: threadId,
    hotel_title: "Rego Admin",
    customer_email: ownerEmail,
    customer_name: ownerName,
  } as unknown as BookingRow;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "relative inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
          hasUnread
            ? "border-red-300 bg-red-50 text-red-600"
            : "border-border bg-card text-forest hover:bg-muted"
        )}
      >
        <Headset className="h-4 w-4" /> Message Admin
        {hasUnread && (
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" />
        )}
      </button>
      {open && (
        <ChatModal
          booking={booking}
          currentEmail={ownerEmail}
          currentName={ownerName}
          currentAvatar={ownerAvatar}
          otherLabel="Rego Admin"
          onSeen={() => markSeen(threadId)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

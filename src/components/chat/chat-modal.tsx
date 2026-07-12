"use client";

import * as React from "react";
import { X, Send, Loader2 } from "lucide-react";

import { getMessages, sendMessage, type MessageRow } from "@/lib/messages";
import { subscribeToMessages } from "@/lib/realtime";
import { usePoll } from "@/lib/use-poll";
import { bookingRef, type BookingRow } from "@/lib/bookings";
import { cn } from "@/lib/utils";

export function ChatModal({
  booking,
  currentEmail,
  currentName,
  currentAvatar,
  otherLabel,
  onClose,
  onSeen,
}: {
  booking: BookingRow;
  currentEmail: string;
  currentName: string;
  currentAvatar?: string | null;
  otherLabel: string;
  onClose: () => void;
  onSeen?: () => void;
}) {
  const [messages, setMessages] = React.useState<MessageRow[]>([]);
  const [text, setText] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(async () => {
    const m = await getMessages(booking.id);
    setMessages(m);
    setLoading(false);
    onSeen?.();
  }, [booking.id, onSeen]);

  React.useEffect(() => {
    load();
  }, [load]);
  // Slow safety-net poll (paused when tab hidden); Realtime handles the rest.
  usePoll(load, 10000);

  // Realtime: append new messages the instant they arrive.
  React.useEffect(() => {
    const unsub = subscribeToMessages((m) => {
      if (m.booking_id !== booking.id) return;
      setMessages((prev) =>
        prev.some((x) => x.id === m.id) ? prev : [...prev, m]
      );
      onSeen?.();
    });
    return unsub;
  }, [booking.id, onSeen]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setSending(true);
    await sendMessage({
      booking_id: booking.id,
      sender_email: currentEmail,
      sender_name: currentName,
      sender_avatar: currentAvatar ?? null,
      text: value,
    });
    setText("");
    setSending(false);
    await load();
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <div className="absolute inset-0 bg-forest-900/50" onClick={onClose} />
      <div className="relative flex h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-card">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border bg-forest-600 px-4 py-3 text-white">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{otherLabel}</p>
            <p className="truncate text-xs text-white/70">
              {booking.hotel_title} · {bookingRef(booking.id)}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close chat"
            className="grid h-8 w-8 place-items-center rounded-full text-white/90 hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 space-y-2 overflow-y-auto bg-forest-50/40 p-4">
          {loading ? (
            <div className="grid h-full place-items-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              No messages yet. Say hello 👋
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.sender_email === currentEmail;
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-end gap-2",
                    mine ? "justify-end" : "justify-start"
                  )}
                >
                  {!mine && (
                    <Avatar url={m.sender_avatar} name={m.sender_name} />
                  )}
                  <div
                    className={cn(
                      "max-w-[72%] rounded-2xl px-3 py-2 text-sm",
                      mine
                        ? "rounded-br-sm bg-forest-600 text-white"
                        : "rounded-bl-sm border border-border bg-white text-forest"
                    )}
                  >
                    {!mine && (
                      <p className="mb-0.5 text-[10px] font-semibold text-gold-700">
                        {m.sender_name ?? "Guest"}
                      </p>
                    )}
                    {m.text}
                  </div>
                  {mine && <Avatar url={m.sender_avatar} name={m.sender_name} />}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={send}
          className="flex items-center gap-2 border-t border-border p-3"
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 rounded-full border border-border px-4 py-2 text-sm text-forest focus:border-forest-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="grid h-10 w-10 place-items-center rounded-full bg-gold text-forest-900 disabled:opacity-50"
            aria-label="Send"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function Avatar({ url, name }: { url: string | null; name: string | null }) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-7 w-7 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gold text-[11px] font-bold text-forest-900">
      {(name ?? "G").charAt(0).toUpperCase()}
    </span>
  );
}

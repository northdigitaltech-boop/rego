"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import {
  Heart,
  Sparkles,
  TicketCheck,
  Bell,
  MessageCircle,
  X,
  MessageSquare,
} from "lucide-react";

import { type NotificationRow } from "@/lib/notifications";
import { cn } from "@/lib/utils";

/** Latest message per booking, as already computed by the navbar. */
export interface BottomNavMessage {
  id: string;
  who: string;
  text: string;
  time: string;
}

interface MobileBottomNavigationProps {
  /** Signed-in state — notifications/messages need an account. */
  signedIn: boolean;
  /** Where an unauthenticated tap should send the user. */
  signInHref: string;
  /** Unread counts from the existing hooks/queries (never fabricated). */
  notificationCount: number;
  messageCount: number;
  /** Data already loaded by the navbar — passed down, never re-fetched. */
  notifications: NotificationRow[];
  messages: BottomNavMessage[];
  isMessageUnread: (bookingId: string) => boolean;
  timeAgo: (iso: string) => string;
  /** Existing handlers, reused as-is. */
  onOpenNotification: (n: NotificationRow) => void;
  onOpenMessage: (bookingId: string) => void;
  onOpenBookingStatus: () => void;
  /** The recommendations control (existing RecommendationsBell in sheet mode). */
  recommendationsSlot: React.ReactNode;
}

/** Cap the badge like native apps do. */
function badge(n: number): string {
  return n > 99 ? "99+" : String(n);
}

/**
 * Fixed, icon-only bottom navigation for phones/tablets (hidden from `xl` up,
 * matching the breakpoint where this project switches to the desktop navbar).
 * Mirrors the five quick actions that used to sit in the mobile menu:
 * Favorites · Recommendations · Booking Status · Notifications · Messages.
 */
export function MobileBottomNavigation({
  signedIn,
  signInHref,
  notificationCount,
  messageCount,
  notifications,
  messages,
  isMessageUnread,
  timeAgo,
  onOpenNotification,
  onOpenMessage,
  onOpenBookingStatus,
  recommendationsSlot,
}: MobileBottomNavigationProps) {
  const pathname = usePathname();
  const [sheet, setSheet] = React.useState<null | "notifications" | "messages">(null);

  const favoritesActive = pathname === "/wishlist";

  return (
    <>
      <nav
        aria-label="Quick actions"
        className={cn(
          "fixed inset-x-0 bottom-0 z-[100] xl:hidden",
          "border-t border-border bg-white",
          "shadow-[0_-1px_12px_rgba(0,42,33,0.06)]"
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto flex h-16 max-w-lg items-stretch justify-between">
          {/* 1 — Favorites */}
          <Item>
            <Link
              href="/wishlist"
              aria-label="Favorites"
              aria-current={favoritesActive ? "page" : undefined}
              className={cn(itemClass, favoritesActive ? activeClass : idleClass)}
            >
              {favoritesActive && <ActiveBar />}
              <Heart className="h-7 w-7" strokeWidth={1.9} />
            </Link>
          </Item>

          {/* 2 — Recommendations (existing bell, sheet mode) */}
          <Item>
            <span className={cn(itemClass, idleClass)}>{recommendationsSlot}</span>
          </Item>

          {/* 3 — Booking Status */}
          <Item>
            <button
              type="button"
              onClick={onOpenBookingStatus}
              aria-label="Booking Status"
              className={cn(itemClass, idleClass)}
            >
              <TicketCheck className="h-7 w-7" strokeWidth={1.9} />
            </button>
          </Item>

          {/* 4 — Notifications */}
          <Item>
            <NavButton
              label="Notifications"
              count={notificationCount}
              active={sheet === "notifications"}
              signedIn={signedIn}
              signInHref={signInHref}
              onClick={() => setSheet("notifications")}
            >
              <Bell className="h-7 w-7" strokeWidth={1.9} />
            </NavButton>
          </Item>

          {/* 5 — Messages */}
          <Item>
            <NavButton
              label="Messages"
              count={messageCount}
              active={sheet === "messages"}
              signedIn={signedIn}
              signInHref={signInHref}
              onClick={() => setSheet("messages")}
            >
              <MessageCircle className="h-7 w-7" strokeWidth={1.9} />
            </NavButton>
          </Item>
        </ul>
      </nav>

      {sheet && (
        <Sheet
          title={sheet === "notifications" ? "Notifications" : "Messages"}
          onClose={() => setSheet(null)}
        >
          {sheet === "notifications" ? (
            notifications.length === 0 ? (
              <Empty>No notifications yet.</Empty>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    onOpenNotification(n);
                    setSheet(null);
                  }}
                  className={cn(rowClass, !n.is_read && "bg-gold/5")}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold/15 text-gold">
                    <Bell className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-sm font-semibold text-forest", !n.is_read && "font-bold")}>
                        {n.title}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {timeAgo(n.created_at)}
                      </span>
                    </span>
                    {n.message && (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                        {n.message}
                      </span>
                    )}
                  </span>
                </button>
              ))
            )
          ) : messages.length === 0 ? (
            <Empty>No messages yet.</Empty>
          ) : (
            messages.map((m) => {
              const unread = isMessageUnread(m.id);
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    onOpenMessage(m.id);
                    setSheet(null);
                  }}
                  className={cn(rowClass, unread && "bg-forest-50/40")}
                >
                  <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest-50 text-forest-600">
                    <MessageSquare className="h-4 w-4" />
                    {unread && (
                      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-500" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-sm font-semibold text-forest", unread && "font-bold")}>
                        {m.who}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {timeAgo(m.time)}
                      </span>
                    </span>
                    <span className="mt-0.5 line-clamp-1 block text-xs text-muted-foreground">
                      {m.text}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </Sheet>
      )}
    </>
  );
}

/* ---------------- building blocks ---------------- */

const itemClass =
  "relative flex h-full w-full min-h-[48px] min-w-[48px] items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 focus-visible:ring-offset-2";
const idleClass = "text-neutral-600 hover:text-forest-600";
const activeClass = "text-forest-600";

function Item({ children }: { children: React.ReactNode }) {
  return <li className="flex flex-1 items-stretch px-1">{children}</li>;
}

/** Thin indicator above the active icon. */
function ActiveBar() {
  return (
    <span
      aria-hidden
      className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-forest-600"
    />
  );
}

function NavButton({
  label,
  count,
  active,
  signedIn,
  signInHref,
  onClick,
  children,
}: {
  label: string;
  count: number;
  active: boolean;
  signedIn: boolean;
  signInHref: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const content = (
    <>
      {active && <ActiveBar />}
      <span className="relative">
        {children}
        {signedIn && count > 0 && (
          <span className="absolute -right-2 -top-1.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {badge(count)}
          </span>
        )}
      </span>
    </>
  );

  // Signed-out users are sent to sign in, preserving existing auth rules.
  if (!signedIn) {
    return (
      <Link href={signInHref} aria-label={label} className={cn(itemClass, idleClass)}>
        {content}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={active}
      className={cn(itemClass, active ? activeClass : idleClass)}
    >
      {content}
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-muted-foreground">{children}</p>;
}

const rowClass =
  "flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/50";

/** Bottom sheet rendered at <body> so nothing can clip it. */
function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[130] flex items-end bg-black/50 xl:hidden"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="max-h-[75vh] w-full overflow-hidden rounded-t-3xl bg-white shadow-premium-lg"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="font-display text-sm font-bold text-forest">{title}</p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-forest"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body
  );
}

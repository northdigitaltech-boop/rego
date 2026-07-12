"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  MessageCircle,
  Bookmark,
  BookmarkCheck,
  Flag,
  Share2,
  Plane,
  Send,
  X,
  Loader2,
  CheckCircle2,
  Check,
  Clock,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { SoloChatModal } from "@/components/solo/solo-chat-modal";
import {
  createSoloConnection,
  getSoloConnectionStatus,
  soloConnectionRef,
  soloThreadId,
  type SoloConnStatus,
  type SoloTravelerRow,
} from "@/lib/solo";
import { sendEmail } from "@/lib/email";
import { sendMessage } from "@/lib/messages";
import { cn } from "@/lib/utils";

const SAVED_KEY = "rego-solo-saved";

function getSaved(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
  } catch {
    return [];
  }
}

type Kind = "connect" | "join-trip" | "invite";

/** Shared modal + chat state for a traveller profile. */
function useSoloActions(t: SoloTravelerRow) {
  const { user } = useAuth();
  const [modal, setModal] = React.useState<Kind | null>(null);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [shareMsg, setShareMsg] = React.useState("");
  const [connStatus, setConnStatus] = React.useState<SoloConnStatus>("none");

  React.useEffect(() => {
    setSaved(getSaved().includes(t.id));
  }, [t.id]);

  const isOwnProfile =
    !!user && !!t.owner_email &&
    user.email.trim().toLowerCase() === t.owner_email.trim().toLowerCase();

  React.useEffect(() => {
    let alive = true;
    if (!user || isOwnProfile || !t.owner_email) {
      setConnStatus("none");
      return;
    }
    getSoloConnectionStatus(user.email, t.owner_email).then((s) => {
      if (alive) setConnStatus(s);
    });
    return () => {
      alive = false;
    };
  }, [user, isOwnProfile, t.owner_email]);

  const toggleSave = () => {
    const cur = getSaved();
    const next = cur.includes(t.id) ? cur.filter((x) => x !== t.id) : [...cur, t.id];
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    setSaved(next.includes(t.id));
  };

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (navigator.share) {
        await navigator.share({ title: `${t.full_name} · Rego`, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareMsg("Profile link copied!");
        setTimeout(() => setShareMsg(""), 2500);
      }
    } catch {
      /* cancelled */
    }
  };

  const modals = (
    <>
      {modal && (
        <ConnectModal
          traveler={t}
          kind={modal}
          onClose={() => setModal(null)}
        />
      )}
      {chatOpen && user && t.owner_email && (
        <SoloChatModal
          currentEmail={user.email}
          currentName={user.name}
          currentAvatar={user.avatar}
          otherEmail={t.owner_email}
          otherLabel={t.full_name}
          onClose={() => setChatOpen(false)}
        />
      )}
      {reportOpen && (
        <ReportModal traveler={t} onClose={() => setReportOpen(false)} />
      )}
    </>
  );

  return {
    user,
    isOwnProfile,
    connStatus,
    saved,
    shareMsg,
    openModal: setModal,
    openChat: () => setChatOpen(true),
    toggleSave,
    share,
    openReport: () => setReportOpen(true),
    modals,
  };
}

/** Small green "Travel Partner" badge shown once a connection is approved. */
function TravelPartnerBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-xl bg-green-50 px-5 py-2.5 text-sm font-bold text-green-700",
        className
      )}
    >
      <Check className="h-4 w-4" /> Travel Partner
    </span>
  );
}

/* ---------------- Header actions ---------------- */

export function SoloHeaderActions({ traveler }: { traveler: SoloTravelerRow }) {
  const a = useSoloActions(traveler);

  if (a.isOwnProfile) {
    return (
      <div className="flex flex-wrap gap-2">
        <Link
          href="/connect/setup"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-forest px-5 py-2.5 text-sm font-semibold text-white shadow-soft hover:opacity-95"
        >
          Edit my profile
        </Link>
        <Link
          href="/connect/requests"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-semibold text-forest hover:bg-muted"
        >
          My connections
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {a.connStatus === "accepted" ? (
          <TravelPartnerBadge />
        ) : (
          <button
            onClick={() => a.openModal("connect")}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-gold px-5 py-2.5 text-sm font-semibold text-forest-900 shadow-soft transition-transform hover:-translate-y-0.5"
          >
            {a.connStatus === "pending" ? <><Clock className="h-4 w-4" /> Requested</> : <><UserPlus className="h-4 w-4" /> Connect</>}
          </button>
        )}
        <button
          onClick={a.openChat}
          className="inline-flex items-center gap-2 rounded-xl bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white shadow-soft hover:bg-forest-700"
        >
          <MessageCircle className="h-4 w-4" /> Send Message
        </button>
        <button
          onClick={a.toggleSave}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors",
            a.saved
              ? "border-gold bg-gold/10 text-gold-700"
              : "border-border bg-card text-forest hover:bg-muted"
          )}
        >
          {a.saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          {a.saved ? "Saved" : "Save"}
        </button>
        <button
          onClick={a.openReport}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-red-600"
          aria-label="Report user"
        >
          <Flag className="h-4 w-4" /> Report
        </button>
      </div>
      {a.shareMsg && <p className="mt-2 text-xs font-semibold text-forest-600">{a.shareMsg}</p>}
      {a.modals}
    </>
  );
}

/* ---------------- Connect section panel ---------------- */

export function SoloConnectPanel({ traveler }: { traveler: SoloTravelerRow }) {
  const a = useSoloActions(traveler);
  if (a.isOwnProfile) return null;

  return (
    <section className="rounded-3xl border border-border/70 bg-gradient-to-br from-forest-50/60 to-gold/5 p-6 shadow-premium">
      <h2 className="font-display text-xl font-bold text-forest">Join {traveler.full_name.split(" ")[0]}&apos;s journey</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Send a request to travel together, invite them to your trip, or start a chat.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          onClick={() => a.openModal("join-trip")}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-forest px-4 py-3 text-sm font-semibold text-white shadow-soft hover:opacity-95"
        >
          <Plane className="h-4 w-4" /> Join My Trip
        </button>
        <button
          onClick={() => a.openModal("invite")}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-forest-900 shadow-soft hover:opacity-95"
        >
          <UserPlus className="h-4 w-4" /> Invite Me
        </button>
        <button
          onClick={a.openChat}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-forest hover:bg-muted"
        >
          <MessageCircle className="h-4 w-4" /> Chat Now
        </button>
        <button
          onClick={a.share}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-forest hover:bg-muted"
        >
          <Share2 className="h-4 w-4" /> Share Profile
        </button>
      </div>
      {a.shareMsg && <p className="mt-2 text-xs font-semibold text-forest-600">{a.shareMsg}</p>}
      {a.modals}
    </section>
  );
}

/* ---------------- Sidebar compact actions ---------------- */

export function SoloSidebarActions({ traveler }: { traveler: SoloTravelerRow }) {
  const a = useSoloActions(traveler);
  if (a.isOwnProfile) {
    return (
      <Link
        href="/connect/setup"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-forest px-4 py-3 text-sm font-semibold text-white shadow-soft hover:opacity-95"
      >
        Edit my profile
      </Link>
    );
  }
  return (
    <>
      {a.connStatus === "accepted" ? (
        <TravelPartnerBadge className="w-full" />
      ) : (
        <button
          onClick={() => a.openModal("connect")}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-gold px-4 py-3 text-sm font-semibold text-forest-900 shadow-soft hover:opacity-95"
        >
          {a.connStatus === "pending" ? <><Clock className="h-4 w-4" /> Requested</> : <><UserPlus className="h-4 w-4" /> Connect</>}
        </button>
      )}
      <button
        onClick={a.openChat}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-forest/30 px-4 py-3 text-sm font-semibold text-forest hover:bg-forest-50"
      >
        <MessageCircle className="h-4 w-4" /> Chat Now
      </button>
      {a.modals}
    </>
  );
}

/* ---------------- Compact card Connect button ----------------
 * Signed-out → sends to sign-in first. Signed-in → opens the reservation
 * form. Once a connection is accepted → shows a "Travel Partner" badge
 * instead of Connect. Used inside the (linked) traveller card, so clicks are
 * isolated from the card navigation. */
export function SoloConnectButton({
  traveler,
  className,
}: {
  traveler: SoloTravelerRow;
  className?: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [status, setStatus] = React.useState<SoloConnStatus | "loading">("loading");
  const [open, setOpen] = React.useState(false);

  const isOwn =
    !!user && !!traveler.owner_email &&
    user.email.trim().toLowerCase() === traveler.owner_email.trim().toLowerCase();

  const refresh = React.useCallback(() => {
    if (!user || isOwn || !traveler.owner_email) {
      setStatus("none");
      return;
    }
    getSoloConnectionStatus(user.email, traveler.owner_email).then(setStatus);
  }, [user, isOwn, traveler.owner_email]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  if (isOwn) return null;

  const stop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Approved → Travel Partner badge (no more Connect).
  if (status === "accepted") {
    return (
      <span
        onClick={stop}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700",
          className
        )}
      >
        <Check className="h-3.5 w-3.5" /> Travel Partner
      </span>
    );
  }

  const handleClick = (e: React.MouseEvent) => {
    stop(e);
    if (!user) {
      router.push(`/signin?redirect=/connect/${traveler.id}`);
      return;
    }
    setOpen(true);
  };

  const pending = status === "pending";

  return (
    <>
      <button
        onClick={handleClick}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold shadow-soft transition-transform hover:-translate-y-0.5",
          pending
            ? "bg-forest-50 text-forest-600"
            : "bg-gradient-gold text-forest-900",
          className
        )}
      >
        {pending ? <><Clock className="h-3.5 w-3.5" /> Requested</> : <><UserPlus className="h-3.5 w-3.5" /> Connect</>}
      </button>
      {open && (
        <ConnectModal
          traveler={traveler}
          kind="connect"
          onClose={() => {
            setOpen(false);
            refresh();
          }}
        />
      )}
    </>
  );
}

/* ---------------- Connect / join / invite modal ---------------- */

const KIND_META: Record<Kind, { title: string; verb: string; icon: React.ElementType }> = {
  connect: { title: "Send a connection request", verb: "connect", icon: UserPlus },
  "join-trip": { title: "Request to join this trip", verb: "join their trip", icon: Plane },
  invite: { title: "Invite to your trip", verb: "invite to your trip", icon: Send },
};

function ConnectModal({
  traveler,
  kind,
  onClose,
}: {
  traveler: SoloTravelerRow;
  kind: Kind;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  const maxSeats = traveler.available_seats && traveler.available_seats > 0 ? traveler.available_seats : 8;
  const [seats, setSeats] = React.useState("1");
  const [travelDate, setTravelDate] = React.useState(traveler.departure_date ?? "");
  const [pickup, setPickup] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [ref, setRef] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!user) {
      setError("Please sign in to send a request.");
      return;
    }
    const seatCount = Math.max(1, Number(seats) || 1);
    setBusy(true);
    try {
      const { data, error: dbErr } = await createSoloConnection({
        traveler_id: traveler.id,
        traveler_name: traveler.full_name,
        owner_email: traveler.owner_email,
        requester_email: user.email,
        requester_name: user.name,
        requester_avatar: user.avatar ?? null,
        kind,
        seats: seatCount,
        travel_date: travelDate || null,
        pickup: pickup.trim() || null,
        message: message.trim() || null,
      });
      if (dbErr) throw dbErr;
      const number = data?.id ? soloConnectionRef(data.id) : "SOLO";
      setRef(number);

      const summary =
        `${seatCount} seat${seatCount === 1 ? "" : "s"}` +
        (travelDate ? ` · ${travelDate}` : "") +
        (pickup.trim() ? ` · pickup ${pickup.trim()}` : "");

      // Drop an opening line into the shared chat thread so they get an alert.
      if (traveler.owner_email) {
        void sendMessage({
          booking_id: soloThreadId(user.email, traveler.owner_email),
          sender_email: user.email,
          sender_name: user.name,
          sender_avatar: user.avatar ?? null,
          text:
            `Seat reservation request (${number}) — ${summary}.` +
            (message.trim() ? ` "${message.trim()}"` : "") +
            ` Please accept or decline in My connections.`,
        }).catch(() => {});
        void sendEmail(
          traveler.owner_email,
          `New seat reservation on Rego — ${number}`,
          `<p><strong>${user.name}</strong> requested to ${meta.verb}.</p>` +
            `<p><strong>Seats:</strong> ${seatCount}` +
            (travelDate ? `<br/><strong>Date:</strong> ${travelDate}` : "") +
            (pickup.trim() ? `<br/><strong>Pickup:</strong> ${pickup.trim()}` : "") +
            `</p>` +
            (message.trim() ? `<p>${message.trim()}</p>` : "") +
            `<p>Reference: ${number}. Review it under My connections.</p>`
        ).catch(() => {});
      }
    } catch {
      setError("Could not send your request. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card shadow-premium-lg sm:rounded-3xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest-50 text-forest-600">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-base font-bold text-forest">{meta.title}</p>
              <p className="text-xs text-muted-foreground">{traveler.full_name}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-forest">
            <X className="h-5 w-5" />
          </button>
        </div>

        {ref ? (
          <div className="px-6 py-10 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-forest-600" />
            <h3 className="mt-3 font-display text-xl font-bold text-forest">Reservation requested!</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {traveler.full_name} will review your seat request. You&apos;ll be notified in chat and
              can track it under <strong>My connections</strong> once it&apos;s approved.
            </p>
            <div className="mx-auto mt-4 w-fit rounded-xl border border-border bg-muted/40 px-5 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Reference</p>
              <p className="font-display text-lg font-bold tracking-wider text-forest">{ref}</p>
            </div>
            <button
              onClick={onClose}
              className="mt-5 w-full rounded-lg bg-gradient-gold px-4 py-3 text-sm font-semibold text-forest-900"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 px-5 py-5">
            {!user && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
                Please{" "}
                <Link href="/signin" className="font-semibold underline">sign in</Link>{" "}
                to send a request.
              </div>
            )}

            {traveler.available_seats != null && (
              <div className="rounded-lg border border-forest-100 bg-forest-50/60 px-4 py-2.5 text-sm text-forest">
                <strong>{traveler.available_seats}</strong> seat
                {traveler.available_seats === 1 ? "" : "s"} available on this trip
                {(traveler.destinations?.length ?? 0) > 0 && <> to {traveler.destinations!.join(", ")}</>}.
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-forest">Seats to reserve *</span>
                <input
                  type="number"
                  min={1}
                  max={maxSeats}
                  className="auth-input"
                  value={seats}
                  onChange={(e) => setSeats(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-forest">Travel date</span>
                <input
                  type="date"
                  className="auth-input"
                  value={travelDate}
                  onChange={(e) => setTravelDate(e.target.value)}
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-forest">Pickup point</span>
              <input
                className="auth-input"
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                placeholder="e.g. Islamabad, Gilgit city…"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-forest">Message</span>
              <textarea
                rows={3}
                className="auth-input resize-none"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={`Hi ${traveler.full_name.split(" ")[0]}, I'd love to ${meta.verb}…`}
              />
            </label>

            {error && <p className="text-sm font-medium text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy || !user}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-forest px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Reserving…</>
              ) : (
                <><Icon className="h-4 w-4" /> Reserve seat</>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ---------------- Report modal ---------------- */

function ReportModal({
  traveler,
  onClose,
}: {
  traveler: SoloTravelerRow;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [reason, setReason] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    await sendEmail(
      "northdigitaltech@gmail.com",
      `Rego — traveller profile reported`,
      `<p>Profile: <strong>${traveler.full_name}</strong> (${traveler.id})</p>` +
        `<p>Reported by: ${user?.email ?? "anonymous"}</p>` +
        `<p>Reason: ${reason || "(none given)"}</p>`
    ).catch(() => {});
    setBusy(false);
    setSent(true);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-card p-6 shadow-premium-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-forest">Report user</h3>
          <button onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-forest">
            <X className="h-5 w-5" />
          </button>
        </div>
        {sent ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-forest-600" />
            <p className="mt-2 text-sm text-muted-foreground">
              Thank you. Our team will review this profile.
            </p>
            <button
              onClick={onClose}
              className="mt-4 w-full rounded-lg bg-gradient-forest px-4 py-2.5 text-sm font-semibold text-white"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <textarea
              rows={4}
              className="auth-input resize-none"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tell us what's wrong with this profile…"
            />
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />}
              Submit report
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import {
  Loader2,
  Lock,
  Inbox,
  Send,
  Check,
  X,
  MessageCircle,
  Plane,
  UserPlus,
  Users,
  CalendarDays,
  MapPin,
  CheckCircle2,
} from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { useAuth } from "@/components/auth/auth-context";
import { SoloChatModal } from "@/components/solo/solo-chat-modal";
import {
  getSoloConnectionsByOwner,
  getSoloConnectionsByRequester,
  setSoloConnectionStatus,
  soloConnectionRef,
  soloThreadId,
  type SoloConnectionRow,
} from "@/lib/solo";
import { sendMessage } from "@/lib/messages";
import { sendEmail } from "@/lib/email";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<string, React.ElementType> = {
  connect: UserPlus,
  "join-trip": Plane,
  invite: Send,
};

export default function ConnectionRequestsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = React.useState(true);
  const [incoming, setIncoming] = React.useState<SoloConnectionRow[]>([]);
  const [outgoing, setOutgoing] = React.useState<SoloConnectionRow[]>([]);
  const [tab, setTab] = React.useState<"incoming" | "outgoing">("incoming");
  const [chatWith, setChatWith] = React.useState<{ email: string; label: string } | null>(null);

  const load = React.useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const [inc, out] = await Promise.all([
      getSoloConnectionsByOwner(user.email),
      getSoloConnectionsByRequester(user.email),
    ]);
    setIncoming(inc);
    setOutgoing(out);
    setLoading(false);
  }, [user]);

  React.useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, status: "accepted" | "rejected") => {
    if (!user) return;
    const row = incoming.find((r) => r.id === id);
    await setSoloConnectionStatus(id, status);
    setIncoming((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));

    // Notify the requester so they "receive" the decision (chat + email).
    if (row) {
      const ref = soloConnectionRef(row.id);
      const seatTxt = `${row.seats} seat${row.seats === 1 ? "" : "s"}`;
      const msg =
        status === "accepted"
          ? `Your seat reservation ${ref} (${seatTxt}) has been APPROVED ✅. See you on the trip!`
          : `Your seat reservation ${ref} could not be confirmed this time.`;
      void sendMessage({
        booking_id: soloThreadId(user.email, row.requester_email),
        sender_email: user.email,
        sender_name: user.name,
        sender_avatar: user.avatar ?? null,
        text: msg,
      }).catch(() => {});
      void sendEmail(
        row.requester_email,
        status === "accepted"
          ? `Seat reservation approved — ${ref}`
          : `Seat reservation update — ${ref}`,
        `<p>${msg}</p>`
      ).catch(() => {});
    }
  };

  if (!user) {
    return (
      <>
        <Navbar />
        <main className="grid min-h-[70vh] place-items-center px-6">
          <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-premium">
            <Lock className="mx-auto h-10 w-10 text-forest-600" />
            <h1 className="mt-3 font-display text-xl font-bold text-forest">Sign in to view connections</h1>
            <Link
              href="/signin?redirect=/connect/requests"
              className="mt-5 inline-flex rounded-xl bg-gradient-forest px-6 py-3 text-sm font-semibold text-white"
            >
              Sign in
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  const rows = tab === "incoming" ? incoming : outgoing;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-muted/30 pb-16">
        <div className="bg-gradient-forest text-white">
          <div className="container-px py-10">
            <h1 className="font-display text-2xl font-bold sm:text-3xl">My connections</h1>
            <p className="mt-1 text-sm text-white/85">
              Requests to travel together — accept, reply and plan your trip.
            </p>
          </div>
        </div>

        <div className="container-px mt-6">
          <div className="inline-flex rounded-xl border border-border bg-card p-1">
            <TabBtn active={tab === "incoming"} onClick={() => setTab("incoming")} icon={Inbox}>
              Received ({incoming.length})
            </TabBtn>
            <TabBtn active={tab === "outgoing"} onClick={() => setTab("outgoing")} icon={Send}>
              Sent ({outgoing.length})
            </TabBtn>
          </div>

          {loading ? (
            <div className="grid place-items-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-forest-600" />
            </div>
          ) : rows.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-border bg-card py-16 text-center">
              <Inbox className="mx-auto h-9 w-9 text-forest-600" />
              <p className="mt-2 font-display text-lg font-semibold text-forest">Nothing here yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {tab === "incoming"
                  ? "Connection requests from other travellers will appear here."
                  : "Requests you send will appear here."}
              </p>
              <Link href="/connect" className="mt-4 inline-flex rounded-xl bg-gradient-forest px-5 py-2.5 text-sm font-semibold text-white">
                Browse travellers
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {rows.map((r) => {
                const Icon = KIND_ICON[r.kind] ?? UserPlus;
                const otherEmail = tab === "incoming" ? r.requester_email : r.owner_email;
                const otherName =
                  tab === "incoming" ? r.requester_name ?? r.requester_email : r.traveler_name ?? "Traveller";
                return (
                  <div key={r.id} className="rounded-3xl border border-border/70 bg-card p-4 shadow-premium sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-forest-50 text-forest-600">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-display text-sm font-bold text-forest">{otherName}</p>
                          <p className="text-xs capitalize text-muted-foreground">
                            {r.kind.replace("-", " ")} · {soloConnectionRef(r.id)}
                          </p>
                          {/* Reservation details */}
                          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-forest">
                            <span className="inline-flex items-center gap-1 font-semibold">
                              <Users className="h-3.5 w-3.5 text-forest-600" /> {r.seats} seat{r.seats === 1 ? "" : "s"}
                            </span>
                            {r.travel_date && (
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <CalendarDays className="h-3.5 w-3.5" /> {r.travel_date}
                              </span>
                            )}
                            {r.pickup && (
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <MapPin className="h-3.5 w-3.5" /> {r.pickup}
                              </span>
                            )}
                          </div>
                          {r.message && <p className="mt-1.5 text-sm text-muted-foreground">{r.message}</p>}
                        </div>
                      </div>
                      <StatusPill status={r.status} />
                    </div>

                    {r.status === "accepted" && (
                      <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
                        <CheckCircle2 className="h-4 w-4" />
                        {tab === "incoming"
                          ? `You confirmed ${r.seats} seat${r.seats === 1 ? "" : "s"} for ${otherName}.`
                          : `Your ${r.seats} seat${r.seats === 1 ? "" : "s"} ${r.seats === 1 ? "is" : "are"} confirmed!`}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                      {tab === "incoming" && r.status === "pending" && (
                        <>
                          <button
                            onClick={() => act(r.id, "accepted")}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-forest-600 px-4 py-2 text-sm font-semibold text-white hover:bg-forest-700"
                          >
                            <Check className="h-4 w-4" /> Accept
                          </button>
                          <button
                            onClick={() => act(r.id, "rejected")}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-red-600"
                          >
                            <X className="h-4 w-4" /> Decline
                          </button>
                        </>
                      )}
                      {otherEmail && (
                        <button
                          onClick={() => setChatWith({ email: otherEmail, label: otherName })}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-forest/30 px-4 py-2 text-sm font-semibold text-forest hover:bg-forest-50"
                        >
                          <MessageCircle className="h-4 w-4" /> Chat
                        </button>
                      )}
                      {r.traveler_id && (
                        <Link
                          href={`/connect/${r.traveler_id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-forest hover:bg-muted"
                        >
                          View profile
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />

      {chatWith && user && (
        <SoloChatModal
          currentEmail={user.email}
          currentName={user.name}
          currentAvatar={user.avatar}
          otherEmail={chatWith.email}
          otherLabel={chatWith.label}
          onClose={() => setChatWith(null)}
        />
      )}
    </>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
        active ? "bg-forest-600 text-white" : "text-forest hover:bg-muted"
      )}
    >
      <Icon className="h-4 w-4" /> {children}
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700",
    accepted: "bg-green-50 text-green-700",
    rejected: "bg-red-50 text-red-600",
  };
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize", map[status] ?? "bg-muted text-muted-foreground")}>
      {status}
    </span>
  );
}

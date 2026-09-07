"use client";

import * as React from "react";
import { Loader2, MessageSquare, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/components/auth/auth-context";
import { StaffThread } from "@/components/portal/staff-thread";
import { unreadByStaff } from "@/lib/staff-messages";
import { getStaffMembers, type StaffMemberRow } from "@/lib/staff";

/* ============================================================
 * Team conversations, on the Messages screen.
 *
 * WHY IT IS HERE AND NOT ONLY IN TEAM MANAGEMENT
 *   I put it only on the member's card in Team Management, and an
 *   admin looking for a message went to the screen called
 *   "Messages" — which is the obvious place and the one I had not
 *   used. From their side the message had simply not arrived.
 *
 *   The thread on the member card stays: it belongs next to their
 *   permissions when the conversation is about their work. This is
 *   the same data in the place people already look for messages,
 *   not a copy of it.
 *
 * The provider chat above it is a different system on a different
 * table — see phase112 for why they are not merged.
 * ============================================================ */

export function AdminTeamMessages() {
  const { user } = useAuth();
  const [members, setMembers] = React.useState<StaffMemberRow[] | null>(null);
  const [names, setNames] = React.useState<Record<string, string>>({});
  const [unread, setUnread] = React.useState<Record<string, number>>({});
  const [openId, setOpenId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const rows = await getStaffMembers();
    setMembers(rows);
    setUnread(await unreadByStaff());

    if (rows.length === 0 || !isSupabaseConfigured) return;
    const { data } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in(
        "id",
        rows.map((r) => r.profile_id)
      );
    const map: Record<string, string> = {};
    for (const p of (data as
      | { id: string; email: string | null; full_name: string | null }[]
      | null) ?? []) {
      map[p.id] = p.full_name || p.email || "";
    }
    setNames(map);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (members === null) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (members.length === 0) return null;

  /* Anyone with something waiting comes first. An unanswered message is the
     reason somebody opened this screen. */
  const sorted = [...members].sort(
    (a, b) => (unread[b.id] ?? 0) - (unread[a.id] ?? 0)
  );
  const waiting = Object.values(unread).reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-premium">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold text-forest">
        <Users className="h-5 w-5" />
        Your team
        {waiting > 0 && (
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
            {waiting} unread
          </span>
        )}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Messages with Rego team members. Separate from the provider
        conversations above, and seen only by that person and by admins.
      </p>

      <div className="mt-4 space-y-2">
        {sorted.map((m) => {
          const who = names[m.profile_id] || m.employee_code;
          const open = openId === m.id;
          const n = unread[m.id] ?? 0;
          return (
            <div
              key={m.id}
              className={cn(
                "overflow-hidden rounded-2xl border",
                open ? "border-forest" : "border-border"
              )}
            >
              <button
                type="button"
                onClick={() => {
                  setOpenId(open ? null : m.id);
                  /* Reading it clears the badge — the thread marks it read on
                     mount, so the count here should agree. */
                  if (!open) setUnread((u) => ({ ...u, [m.id]: 0 }));
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
              >
                <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-forest">{who}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {m.employee_code}
                  </span>
                </span>
                {n > 0 && (
                  <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    {n}
                  </span>
                )}
              </button>

              {open && (
                <div className="border-t border-border p-4">
                  <StaffThread
                    staffId={m.id}
                    senderName={user?.name ?? "Rego"}
                    fromAdmin
                    emptyLine="Nothing yet. Anything written here is seen only by this person and by admins."
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

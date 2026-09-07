"use client";

import * as React from "react";
import { Loader2, Send } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  loadThread,
  markRead,
  sendMessage,
  type StaffMessage,
} from "@/lib/staff-messages";

/* ============================================================
 * One conversation, drawn the same way for both sides.
 *
 * The portal renders it with fromAdmin=false and Team Management
 * with fromAdmin=true, so there is one component to fix when the
 * bubble alignment is wrong rather than two that drift.
 *
 * Marking as read happens on MOUNT, for the other side's messages
 * only. Read receipts that fire on send would mean a member's
 * reply silently marked the admin's message read whether or not
 * they scrolled to it.
 * ============================================================ */

export function StaffThread({
  staffId,
  senderName,
  fromAdmin,
  emptyLine,
}: {
  staffId: string;
  /** Stamped on the message so the thread still reads after somebody leaves. */
  senderName: string;
  /** True in Team Management, false in the portal. Checked by the database. */
  fromAdmin: boolean;
  emptyLine: string;
}) {
  const [messages, setMessages] = React.useState<StaffMessage[] | null>(null);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setMessages(await loadThread(staffId));
  }, [staffId]);

  React.useEffect(() => {
    void load();
    /* Theirs, not mine: !fromAdmin is the other side. */
    void markRead(staffId, !fromAdmin);
  }, [staffId, fromAdmin, load]);

  const send = async () => {
    setBusy(true);
    setError("");
    const res = await sendMessage({ staffId, body: draft, senderName, fromAdmin });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not send that.");
      return;
    }
    setDraft("");
    await load();
  };

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="max-h-[26rem] space-y-3 overflow-y-auto rounded-2xl border border-border bg-muted/20 p-4">
        {messages === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{emptyLine}</p>
        ) : (
          messages.map((m) => {
            const mine = m.from_admin === fromAdmin;
            return (
              <div
                key={m.id}
                className={cn("flex", mine ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                    mine
                      ? "bg-forest text-white"
                      : "border border-border bg-card text-forest"
                  )}
                >
                  <p
                    className={cn(
                      "text-[11px] font-semibold",
                      mine ? "text-white/70" : "text-muted-foreground"
                    )}
                  >
                    {m.sender_name || (m.from_admin ? "Rego" : "Team member")} ·{" "}
                    {new Date(m.created_at).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {/* whitespace-pre-wrap: somebody's line breaks are part of
                      what they wrote. */}
                  <p className="mt-1 whitespace-pre-wrap break-words">{m.body}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            /* Enter sends, Shift+Enter is a new line — the convention
               everybody already has in their fingers. */
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (draft.trim() && !busy) void send();
            }
          }}
          rows={2}
          placeholder="Write a message…"
          className="auth-input flex-1 resize-y"
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || !draft.trim()}
          className="inline-flex shrink-0 items-center gap-2 self-end rounded-lg bg-forest px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Messages cannot be edited or deleted once sent, by either side.
      </p>
    </div>
  );
}

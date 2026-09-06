"use client";

import * as React from "react";
import { Plus, Loader2, Phone, MessageCircle, CalendarClock } from "lucide-react";

import { cn } from "@/lib/utils";
import { can, type StaffProfile } from "@/lib/staff-portal";
import {
  ACTIVITY_KINDS,
  LEAD_STAGES,
  STAGE_LABEL,
  createLead,
  listActivities,
  listLeads,
  logActivity,
  updateLead,
  type Activity,
  type ActivityKind,
  type Lead,
  type LeadStage,
} from "@/lib/staff-leads";

/* ============================================================
 * Leads — providers being talked to who have not registered yet.
 *
 * The moment one registers they become a listing and the referral
 * link credits whoever brought them. So this screen covers the part
 * of the work that happens BEFORE there is anything in the database
 * to point at, which is the part that currently lives in somebody's
 * phone.
 *
 * WHAT IT DELIBERATELY DOES NOT OFFER
 *   Deleting a lead, editing the activity log, and handing a lead to
 *   a colleague. The database refuses all three, so a button for any
 *   of them would be a button that always fails.
 * ============================================================ */

const STAGE_STYLE: Record<LeadStage, string> = {
  new: "bg-muted text-forest",
  contacted: "bg-blue-50 text-blue-700",
  interested: "bg-gold/20 text-gold-700",
  registered: "bg-emerald-50 text-emerald-700",
  lost: "bg-red-50 text-red-700",
};

export function PortalLeads({ profile }: { profile: StaffProfile }) {
  const [leads, setLeads] = React.useState<Lead[] | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [error, setError] = React.useState("");

  const mayWrite = can(profile, "manage_own_leads");

  const load = React.useCallback(async () => {
    setLeads(await listLeads());
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (!can(profile, "view_leads") && !mayWrite) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold text-forest">Leads</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Your role does not include leads. If that is wrong, ask an admin —
          the database decides this, not this screen.
        </p>
      </section>
    );
  }

  const open = leads?.find((l) => l.id === openId) ?? null;

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-forest">Leads</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Providers you are talking to. Once they register, the referral
              link credits you automatically.
            </p>
          </div>
          {mayWrite && (
            <button
              type="button"
              onClick={() => setAdding((a) => !a)}
              className="inline-flex items-center gap-2 rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              {adding ? "Cancel" : "Add a lead"}
            </button>
          )}
        </div>

        {adding && (
          <AddLead
            profile={profile}
            onDone={async () => {
              setAdding(false);
              await load();
            }}
            onError={setError}
          />
        )}
      </section>

      {leads === null ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : leads.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
          No leads yet. Add the first provider you are talking to.
        </p>
      ) : (
        <ul className="space-y-3">
          {leads.map((l) => (
            <li key={l.id}>
              <LeadRow
                lead={l}
                mine={l.staff_id === profile.staff_id}
                expanded={openId === l.id}
                onToggle={() => setOpenId(openId === l.id ? null : l.id)}
              />
              {openId === l.id && open && (
                <LeadDetail
                  lead={open}
                  profile={profile}
                  onChanged={load}
                  onError={setError}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LeadRow({
  lead,
  mine,
  expanded,
  onToggle,
}: {
  lead: Lead;
  mine: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const overdue =
    lead.next_follow_up &&
    !["registered", "lost"].includes(lead.stage) &&
    new Date(lead.next_follow_up) < new Date(new Date().toDateString());

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-2xl border bg-card p-4 text-left transition-colors",
        expanded ? "border-forest" : "border-border hover:bg-muted/50"
      )}
    >
      <div className="min-w-0">
        <p className="truncate font-semibold text-forest">{lead.business_name}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {[lead.contact_name, lead.category, lead.phone].filter(Boolean).join(" · ") ||
            "No contact details yet"}
        </p>
        {lead.next_follow_up && (
          <p
            className={cn(
              "mt-1 inline-flex items-center gap-1 text-xs",
              overdue ? "font-semibold text-red-600" : "text-muted-foreground"
            )}
          >
            <CalendarClock className="h-3 w-3" />
            {overdue ? "Follow-up overdue: " : "Follow up: "}
            {new Date(lead.next_follow_up).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
            })}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {/* Whose lead it is, when a manager is looking at the department. */}
        {!mine && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            Colleague
          </span>
        )}
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            STAGE_STYLE[lead.stage]
          )}
        >
          {STAGE_LABEL[lead.stage]}
        </span>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */

function LeadDetail({
  lead,
  profile,
  onChanged,
  onError,
}: {
  lead: Lead;
  profile: StaffProfile;
  onChanged: () => Promise<void>;
  onError: (s: string) => void;
}) {
  const [activities, setActivities] = React.useState<Activity[] | null>(null);
  const [busy, setBusy] = React.useState(false);

  /* Only the owner may change anything. A colleague with view_leads is
     reading, and the database would refuse their write anyway. */
  const mine = lead.staff_id === profile.staff_id;
  const mayEdit = mine && can(profile, "manage_own_leads");
  const mayLog = mine && can(profile, "log_activity");

  const loadLog = React.useCallback(async () => {
    setActivities(await listActivities(lead.id));
  }, [lead.id]);

  React.useEffect(() => {
    void loadLog();
  }, [loadLog]);

  const setStage = async (stage: LeadStage) => {
    setBusy(true);
    const res = await updateLead(lead.id, { stage });
    setBusy(false);
    if (!res.ok) onError(res.error ?? "Could not update the stage.");
    else await onChanged();
  };

  const setFollowUp = async (value: string) => {
    setBusy(true);
    const res = await updateLead(lead.id, { next_follow_up: value || null });
    setBusy(false);
    if (!res.ok) onError(res.error ?? "Could not set the follow-up date.");
    else await onChanged();
  };

  return (
    <div className="mt-2 space-y-4 rounded-2xl border border-border bg-muted/20 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Detail label="Contact" value={lead.contact_name} />
        <Detail label="Category" value={lead.category} />
        <Detail label="Phone" value={lead.phone} tel />
        <Detail label="WhatsApp" value={lead.whatsapp} wa />
        <Detail label="Email" value={lead.email} />
        <Detail label="How we found them" value={lead.source} />
      </div>

      {lead.note && (
        <p className="rounded-xl bg-card p-3 text-sm text-forest">{lead.note}</p>
      )}

      {mayEdit && (
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-forest">Stage</span>
            <select
              value={lead.stage}
              disabled={busy}
              onChange={(e) => setStage(e.target.value as LeadStage)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              {LEAD_STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABEL[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-forest">
              Next follow-up
            </span>
            <input
              type="date"
              value={lead.next_follow_up ?? ""}
              disabled={busy}
              onChange={(e) => setFollowUp(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
            />
          </label>
        </div>
      )}

      {/* ---- activity log ---- */}
      <div>
        <p className="text-sm font-semibold text-forest">What has happened</p>

        {mayLog && (
          <LogActivity
            profile={profile}
            leadId={lead.id}
            onDone={loadLog}
            onError={onError}
          />
        )}

        {activities === null ? (
          <p className="mt-2 text-xs text-muted-foreground">Loading…</p>
        ) : activities.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Nothing logged yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {activities.map((a) => (
              <li key={a.id} className="rounded-xl bg-card p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {a.kind} ·{" "}
                  {new Date(a.happened_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                {a.note && <p className="mt-1 text-forest">{a.note}</p>}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          Entries cannot be edited or removed, here or in the database. A log
          that can be revised afterwards answers a different question from the
          one it is kept for.
        </p>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  tel,
  wa,
}: {
  label: string;
  value: string | null;
  tel?: boolean;
  wa?: boolean;
}) {
  if (!value) return null;
  const digits = value.replace(/[^\d+]/g, "");
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {tel ? (
        <a href={`tel:${digits}`} className="inline-flex items-center gap-1 text-sm font-semibold text-forest">
          <Phone className="h-3 w-3" />
          {value}
        </a>
      ) : wa ? (
        <a
          href={`https://wa.me/${digits.replace(/^\+/, "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm font-semibold text-forest"
        >
          <MessageCircle className="h-3 w-3" />
          {value}
        </a>
      ) : (
        <p className="text-sm text-forest">{value}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function LogActivity({
  profile,
  leadId,
  onDone,
  onError,
}: {
  profile: StaffProfile;
  leadId: string;
  onDone: () => Promise<void>;
  onError: (s: string) => void;
}) {
  const [kind, setKind] = React.useState<ActivityKind>("call");
  const [note, setNote] = React.useState("");
  const [when, setWhen] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    setBusy(true);
    const res = await logActivity({
      staffId: profile.staff_id,
      leadId,
      kind,
      note,
      /* When it HAPPENED, not when it was typed. Somebody logging Thursday's
         visit on Friday should not have Friday in the record. */
      happenedAt: when ? new Date(when).toISOString() : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      onError(res.error ?? "Could not log that.");
      return;
    }
    setNote("");
    setWhen("");
    await onDone();
  };

  return (
    <div className="mt-2 flex flex-wrap items-end gap-2">
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as ActivityKind)}
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
      >
        {ACTIVITY_KINDS.map((k) => (
          <option key={k} value={k}>
            {k[0].toUpperCase() + k.slice(1)}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={when}
        onChange={(e) => setWhen(e.target.value)}
        title="When it happened — leave blank for today"
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What happened?"
        className="auth-input min-w-[12rem] flex-1"
      />
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-forest disabled:opacity-50"
      >
        {busy ? "Saving…" : "Log it"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AddLead({
  profile,
  onDone,
  onError,
}: {
  profile: StaffProfile;
  onDone: () => Promise<void>;
  onError: (s: string) => void;
}) {
  const [businessName, setBusinessName] = React.useState("");
  const [contactName, setContactName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [whatsapp, setWhatsapp] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [source, setSource] = React.useState("");
  const [note, setNote] = React.useState("");
  const [nextFollowUp, setNextFollowUp] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const submit = async () => {
    if (!businessName.trim()) {
      onError("Give the business a name — everything else can come later.");
      return;
    }
    setBusy(true);
    const res = await createLead({
      staffId: profile.staff_id,
      departmentId: profile.department.id,
      businessName,
      contactName,
      phone,
      whatsapp,
      category,
      source,
      note,
      nextFollowUp,
    });
    setBusy(false);
    if (!res.ok) {
      onError(res.error ?? "Could not save that lead.");
      return;
    }
    await onDone();
  };

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-border bg-background p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Business name" required>
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="auth-input"
            placeholder="e.g. Hunza Grand Hotel"
            autoFocus
          />
        </Field>
        <Field label="Who you speak to">
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            className="auth-input"
          />
        </Field>
        <Field label="Phone">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="auth-input"
            inputMode="tel"
            placeholder="+92 3xx…"
          />
        </Field>
        <Field label="WhatsApp">
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            className="auth-input"
            inputMode="tel"
          />
        </Field>
        <Field label="What they do">
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="auth-input"
            placeholder="e.g. hotel, guide, transport"
          />
        </Field>
        <Field label="How you found them">
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="auth-input"
            placeholder="e.g. walk-in, referral, Facebook"
          />
        </Field>
      </div>

      <Field label="Notes">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="auth-input"
        />
      </Field>

      <Field label="Next follow-up">
        <input
          type="date"
          value={nextFollowUp}
          onChange={(e) => setNextFollowUp(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
        />
      </Field>

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save lead"}
      </button>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-forest">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

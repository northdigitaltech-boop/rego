"use client";

import * as React from "react";
import { Search, ShieldCheck, X, KeyRound, Mail, Phone, Loader2, CheckCircle2, UserCog } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface ProfileRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string | null;
  phone: string | null;
  created_at: string;
}

const OWNER_TABLES: [string, string][] = [
  ["hotels", "title"],
  ["homestays", "title"],
  ["restaurants", "name"],
  ["tour_companies", "name"],
  ["tour_guides", "name"],
  ["media_providers", "name"],
  ["transport_providers", "name"],
];

export function AdminClientPasswords() {
  const [rows, setRows] = React.useState<ProfileRow[]>([]);
  const [biz, setBiz] = React.useState<Record<string, string>>({});
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<ProfileRow | null>(null);

  const load = React.useCallback(async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id,email,full_name,role,phone,created_at")
      .order("created_at", { ascending: false });
    setRows((data as ProfileRow[]) ?? []);
    setLoading(false);

    const map: Record<string, string> = {};
    await Promise.all(
      OWNER_TABLES.map(async ([t, nameCol]) => {
        const { data: d } = await supabase.from(t).select(`owner_email, ${nameCol}`);
        (d as Record<string, string>[] | null)?.forEach((r) => {
          const e = (r.owner_email ?? "").toLowerCase();
          if (e && r[nameCol] && !map[e]) map[e] = r[nameCol];
        });
      })
    );
    setBiz(map);
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const t = q.trim().toLowerCase();
    const business = biz[(r.email ?? "").toLowerCase()] ?? "";
    return (
      (r.full_name ?? "").toLowerCase().includes(t) ||
      (r.email ?? "").toLowerCase().includes(t) ||
      (r.phone ?? "").toLowerCase().includes(t) ||
      r.id.toLowerCase().includes(t) ||
      business.toLowerCase().includes(t)
    );
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold text-forest">Password Update — Clients</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Search a client and reset their password, email or phone. Every change is logged.
        </p>
      </div>

      <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email, phone, user ID or business name…"
          className="w-full bg-transparent text-sm text-forest focus:outline-none"
        />
      </label>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-premium">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-3 font-semibold">Name</th>
              <th className="px-3 py-3 font-semibold">Email</th>
              <th className="px-3 py-3 font-semibold">Phone</th>
              <th className="px-3 py-3 font-semibold">Role</th>
              <th className="px-3 py-3 font-semibold">Business</th>
              <th className="px-3 py-3 font-semibold">Created</th>
              <th className="px-3 py-3 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">No clients found.</td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-3 font-semibold text-forest">{r.full_name || "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">{r.email || "—"}</td>
                  <td className="px-3 py-3 text-muted-foreground">{r.phone || "—"}</td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-forest-50 px-2 py-0.5 text-[10px] font-bold uppercase text-forest-700">{r.role || "customer"}</span>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">{biz[(r.email ?? "").toLowerCase()] || "—"}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{(r.created_at || "").slice(0, 10)}</td>
                  <td className="px-3 py-3 text-right">
                    <button
                      onClick={() => setSelected(r)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-forest px-3 py-1.5 text-xs font-semibold text-white hover:-translate-y-0.5"
                    >
                      <UserCog className="h-4 w-4" /> Manage Account
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <ManageModal
          user={selected}
          business={biz[(selected.email ?? "").toLowerCase()] || ""}
          onClose={() => setSelected(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

async function callUpdate(userId: string, field: string, value: string, note: string) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Your session expired. Please sign in again.");
  const res = await fetch("/api/admin/update-user", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ userId, field, value, note }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(json.error || "Update failed.");
}

function ManageModal({
  user,
  business,
  onClose,
  onSaved,
}: {
  user: ProfileRow;
  business: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-forest-900/60 p-3 backdrop-blur-sm sm:p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="my-auto w-full max-w-lg overflow-hidden rounded-3xl bg-card shadow-premium-lg">
        <div className="flex items-start justify-between gap-3 border-b border-border bg-gradient-forest px-5 py-4 text-white">
          <div>
            <h3 className="font-display text-lg font-bold">{user.full_name || user.email}</h3>
            <p className="text-sm text-white/80">Manage account access</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full bg-white/15 hover:bg-white/25">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[75vh] space-y-5 overflow-y-auto p-5">
          {/* details */}
          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-muted/40 p-4 text-sm">
            <Detail k="Full name" v={user.full_name || "—"} />
            <Detail k="Email" v={user.email || "—"} />
            <Detail k="Phone" v={user.phone || "—"} />
            <Detail k="Role" v={user.role || "customer"} />
            <Detail k="Business" v={business || "—"} />
            <Detail k="Created" v={(user.created_at || "").slice(0, 10)} />
            <Detail k="User ID" v={user.id} mono />
          </div>

          <PasswordForm userId={user.id} onSaved={onSaved} />
          <FieldForm userId={user.id} field="email" label="Update email" placeholder="new@email.com" icon={<Mail className="h-4 w-4" />} defaultValue={user.email ?? ""} onSaved={onSaved} />
          <FieldForm userId={user.id} field="phone" label="Update phone number" placeholder="+92 3xx xxxxxxx" icon={<Phone className="h-4 w-4" />} defaultValue={user.phone ?? ""} onSaved={onSaved} />
        </div>
      </div>
    </div>
  );
}

function Detail({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</p>
      <p className={cn("font-medium text-forest", mono && "break-all font-mono text-xs")}>{v}</p>
    </div>
  );
}

function Note({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Reason for update (required)"
      className="w-full rounded-lg border border-border px-3 py-2 text-sm text-forest focus:border-forest-600 focus:outline-none"
    />
  );
}

function Msg({ ok, error }: { ok?: string; error?: string }) {
  if (ok) return <p className="flex items-center gap-1.5 text-sm font-medium text-forest-600"><CheckCircle2 className="h-4 w-4" /> {ok}</p>;
  if (error) return <p className="text-sm font-medium text-red-600">{error}</p>;
  return null;
}

function PasswordForm({ userId, onSaved }: { userId: string; onSaved: () => void }) {
  const [pw, setPw] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [ok, setOk] = React.useState("");
  const [error, setError] = React.useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOk(""); setError("");
    if (pw.length < 6) return setError("Password must be at least 6 characters.");
    if (pw !== confirm) return setError("Passwords do not match.");
    if (!note.trim()) return setError("A reason note is required.");
    if (!window.confirm("Are you sure you want to update this user password?")) return;
    setBusy(true);
    try {
      await callUpdate(userId, "password", pw, note);
      setOk("Client account updated successfully.");
      setPw(""); setConfirm(""); setNote("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2.5 rounded-2xl border border-border p-4">
      <p className="flex items-center gap-2 font-display text-sm font-bold text-forest"><KeyRound className="h-4 w-4" /> Reset password</p>
      <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password" className="w-full rounded-lg border border-border px-3 py-2 text-sm text-forest focus:border-forest-600 focus:outline-none" />
      <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" className="w-full rounded-lg border border-border px-3 py-2 text-sm text-forest focus:border-forest-600 focus:outline-none" />
      <Note value={note} onChange={setNote} />
      <Msg ok={ok} error={error} />
      <button disabled={busy} className="flex items-center gap-1.5 rounded-lg bg-gradient-gold px-3.5 py-2 text-sm font-semibold text-forest-900 disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Update password
      </button>
    </form>
  );
}

function FieldForm({
  userId,
  field,
  label,
  placeholder,
  icon,
  defaultValue,
  onSaved,
}: {
  userId: string;
  field: "email" | "phone";
  label: string;
  placeholder: string;
  icon: React.ReactNode;
  defaultValue: string;
  onSaved: () => void;
}) {
  const [value, setValue] = React.useState(defaultValue);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [ok, setOk] = React.useState("");
  const [error, setError] = React.useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOk(""); setError("");
    if (!note.trim()) return setError("A reason note is required.");
    setBusy(true);
    try {
      await callUpdate(userId, field, value.trim(), note);
      setOk("Client account updated successfully.");
      setNote("");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2.5 rounded-2xl border border-border p-4">
      <p className="flex items-center gap-2 font-display text-sm font-bold text-forest">{icon} {label}</p>
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-border px-3 py-2 text-sm text-forest focus:border-forest-600 focus:outline-none" />
      <Note value={note} onChange={setNote} />
      <Msg ok={ok} error={error} />
      <button disabled={busy} className="flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-forest hover:bg-muted disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save {field}
      </button>
    </form>
  );
}

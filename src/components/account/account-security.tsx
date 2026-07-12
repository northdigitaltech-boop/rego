"use client";

import * as React from "react";
import { KeyRound, Mail, Phone, Eye, EyeOff, CheckCircle2, Loader2 } from "lucide-react";

import { supabase } from "@/lib/supabase";

// Self-service account security panel. The signed-in user updates their OWN
// password / email / phone. This uses the normal (anon) client + the user's
// session — a user is always allowed to update their own credentials, so NO
// service-role key is involved here (that key stays server-only, admin-only).

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const PHONE_RE = /^[+]?[\d\s()-]{7,20}$/;

type Note = { kind: "ok" | "err"; text: string } | null;

function fieldWrap(children: React.ReactNode) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5">
      {children}
    </div>
  );
}

export function AccountSecurity() {
  const [uid, setUid] = React.useState<string | null>(null);
  const [currentEmail, setCurrentEmail] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      setUid(data.user?.id ?? null);
      setCurrentEmail(data.user?.email ?? "");
      if (data.user?.id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", data.user.id)
          .maybeSingle();
        if (alive && prof?.phone) setPhone(prof.phone as string);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ---- password ----
  const [pw, setPw] = React.useState("");
  const [pw2, setPw2] = React.useState("");
  const [showPw, setShowPw] = React.useState(false);
  const [pwNote, setPwNote] = React.useState<Note>(null);
  const [pwBusy, setPwBusy] = React.useState(false);

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwNote(null);
    if (pw.length < 6) return setPwNote({ kind: "err", text: "Password must be at least 6 characters." });
    if (pw !== pw2) return setPwNote({ kind: "err", text: "Passwords do not match." });
    if (!window.confirm("Are you sure you want to update your password?")) return;
    setPwBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setPw("");
      setPw2("");
      setPwNote({ kind: "ok", text: "Password updated successfully." });
    } catch (err) {
      setPwNote({ kind: "err", text: err instanceof Error ? err.message : "Could not update password." });
    } finally {
      setPwBusy(false);
    }
  };

  // ---- email ----
  const [email, setEmail] = React.useState("");
  const [emailNote, setEmailNote] = React.useState<Note>(null);
  const [emailBusy, setEmailBusy] = React.useState(false);

  const saveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailNote(null);
    const next = email.trim().toLowerCase();
    if (!EMAIL_RE.test(next)) return setEmailNote({ kind: "err", text: "Please enter a valid email address." });
    if (next === currentEmail.toLowerCase()) return setEmailNote({ kind: "err", text: "That is already your email." });
    setEmailBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: next });
      if (error) throw error;
      if (uid) await supabase.from("profiles").update({ email: next }).eq("id", uid);
      setEmail("");
      setEmailNote({
        kind: "ok",
        text: "Email update requested. Check your new inbox for a confirmation link to complete the change.",
      });
    } catch (err) {
      setEmailNote({ kind: "err", text: err instanceof Error ? err.message : "Could not update email." });
    } finally {
      setEmailBusy(false);
    }
  };

  // ---- phone ----
  const [phone, setPhone] = React.useState("");
  const [phoneNote, setPhoneNote] = React.useState<Note>(null);
  const [phoneBusy, setPhoneBusy] = React.useState(false);

  const savePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneNote(null);
    const next = phone.trim();
    if (next && !PHONE_RE.test(next)) return setPhoneNote({ kind: "err", text: "Please enter a valid phone number." });
    if (!uid) return setPhoneNote({ kind: "err", text: "Please sign in again." });
    setPhoneBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ phone: next || null }).eq("id", uid);
      if (error) throw error;
      setPhoneNote({ kind: "ok", text: "Phone number updated successfully." });
    } catch {
      setPhoneNote({ kind: "err", text: "Could not update phone number." });
    } finally {
      setPhoneBusy(false);
    }
  };

  const noteEl = (n: Note) =>
    n && (
      <p className={`text-sm font-medium ${n.kind === "ok" ? "text-forest-600" : "text-red-600"}`}>
        {n.text}
      </p>
    );

  return (
    <div className="mt-6 space-y-6 rounded-2xl border border-border bg-card p-6 shadow-premium sm:p-8">
      <div>
        <h2 className="font-display text-xl font-bold text-forest">Login & security</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your password, email address and phone number.
        </p>
      </div>

      {/* Password */}
      <form onSubmit={savePassword} className="space-y-3 border-t border-border pt-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-forest">
          <KeyRound className="h-4 w-4 text-gold" /> Change password
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {fieldWrap(
            <>
              <input
                type={showPw ? "text" : "password"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="New password"
                autoComplete="new-password"
                className="w-full bg-transparent text-sm text-forest focus:outline-none"
              />
              <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Hide" : "Show"} className="text-muted-foreground">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </>
          )}
          {fieldWrap(
            <input
              type={showPw ? "text" : "password"}
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              className="w-full bg-transparent text-sm text-forest focus:outline-none"
            />
          )}
        </div>
        {noteEl(pwNote)}
        <button
          type="submit"
          disabled={pwBusy}
          className="inline-flex items-center gap-2 rounded-lg bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-60"
        >
          {pwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Update password
        </button>
      </form>

      {/* Email */}
      <form onSubmit={saveEmail} className="space-y-3 border-t border-border pt-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-forest">
          <Mail className="h-4 w-4 text-gold" /> Change email
        </div>
        <p className="text-xs text-muted-foreground">Current: {currentEmail || "—"}</p>
        {fieldWrap(
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="New email address"
            autoComplete="email"
            className="w-full bg-transparent text-sm text-forest focus:outline-none"
          />
        )}
        {noteEl(emailNote)}
        <button
          type="submit"
          disabled={emailBusy}
          className="inline-flex items-center gap-2 rounded-lg bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-60"
        >
          {emailBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Update email
        </button>
      </form>

      {/* Phone */}
      <form onSubmit={savePhone} className="space-y-3 border-t border-border pt-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-forest">
          <Phone className="h-4 w-4 text-gold" /> Phone number
        </div>
        {fieldWrap(
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. +92 300 1234567"
            autoComplete="tel"
            className="w-full bg-transparent text-sm text-forest focus:outline-none"
          />
        )}
        {noteEl(phoneNote)}
        <button
          type="submit"
          disabled={phoneBusy}
          className="inline-flex items-center gap-2 rounded-lg bg-forest-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-forest-700 disabled:opacity-60"
        >
          {phoneBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Save phone number
        </button>
      </form>
    </div>
  );
}

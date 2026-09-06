"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/layout/logo";
import { useAuth, setFlash } from "@/components/auth/auth-context";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { resetPassword } = useAuth();

  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [show, setShow] = React.useState(false);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [hasSession, setHasSession] = React.useState<boolean | null>(null);

  /* An invited person is not resetting anything — they have never had a
     password. Same screen, same session handling, honest wording.

     Read from window rather than useSearchParams: that hook would opt this
     route out of static rendering and require a Suspense boundary, to read one
     flag that only ever exists in a browser. */
  const [welcome, setWelcome] = React.useState(false);

  /* Supabase reports a refused link in the URL FRAGMENT, not the query:
     #error=access_denied&error_code=otp_expired&error_description=…
     Nothing was reading it, so a spent or superseded link produced a page
     that simply said the link was invalid, with no hint as to which of the
     several quite different reasons applied. */
  const [linkError, setLinkError] = React.useState("");

  React.useEffect(() => {
    setWelcome(new URLSearchParams(window.location.search).get("welcome") === "1");

    const frag = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const code = frag.get("error_code");
    if (code === "otp_expired") {
      setLinkError(
        "This link has already been used or has been replaced by a newer one. If you asked for a reset more than once, only the most recent email works — open that one. Otherwise ask for a new link."
      );
    } else if (frag.get("error")) {
      setLinkError(
        frag.get("error_description")?.replace(/\+/g, " ") ??
          "This link could not be used."
      );
    }
  }, []);

  // Supabase auto-detects the recovery token in the URL and establishes a
  // temporary session; confirm one exists before showing the form.
  React.useEffect(() => {
    let alive = true;
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (alive) setHasSession(!!data.session);
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (alive) setHasSession(!!session);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await resetPassword("", "", password);
      setFlash(
        welcome
          ? "Your password is set. Sign in to get started."
          : "Password updated! Please sign in with your new password."
      );
      await supabase.auth.signOut();
      router.push("/signin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-6 py-10">
      <div className="w-full max-w-md">
        <Link
          href="/"
          aria-label="Rego home"
          className="mb-8 flex items-center justify-center rounded-2xl bg-gradient-forest py-7 shadow-premium"
        >
          <BrandLogo className="h-16 w-auto" />
        </Link>

        <div className="rounded-3xl border border-border bg-card p-6 shadow-premium-lg sm:p-8">
          <h1 className="font-display text-2xl font-bold text-forest">
            {welcome ? "Choose your password" : "Set a new password"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {welcome
              ? "Your Rego account is ready. Pick a password and you are in."
              : "Enter and confirm your new password below."}
          </p>

          {hasSession === false ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {/* The specific reason, when Supabase gave one, instead of the
                  generic sentence below it. */}
              {linkError ? (
                <>
                  {linkError}{" "}
                  <Link href="/signin" className="font-semibold underline">
                    Ask for a new link
                  </Link>
                  .
                </>
              ) : welcome ? (
                <>
                  This invitation link is invalid or has expired. Ask whoever added
                  you to send it again.
                </>
              ) : (
                <>
                  This reset link is invalid or has expired. Please request a new reset link from the{" "}
                  <Link href="/signin" className="font-semibold underline">sign-in page</Link>.
                </>
              )}
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-forest">New password</span>
                <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <input
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full bg-transparent text-sm text-forest focus:outline-none"
                  />
                  <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide" : "Show"} className="text-muted-foreground">
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-forest">Confirm password</span>
                <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <input
                    type={show ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter your password"
                    className="w-full bg-transparent text-sm text-forest focus:outline-none"
                  />
                </div>
              </label>

              {error && <p className="text-sm font-medium text-red-600">{error}</p>}

              <Button type="submit" variant="gold" size="lg" className="w-full rounded-lg" disabled={busy || hasSession === null}>
                {busy ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Updating…</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" /> Update password</>
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

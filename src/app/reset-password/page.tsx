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
      setFlash("Password updated! Please sign in with your new password.");
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
          <h1 className="font-display text-2xl font-bold text-forest">Set a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter and confirm your new password below.
          </p>

          {hasSession === false ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This reset link is invalid or has expired. Please request a new reset link from the{" "}
              <Link href="/signin" className="font-semibold underline">sign-in page</Link>.
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

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clientThrottle } from "@/lib/client-throttle";
import { CheckboxCaptcha } from "@/components/auth/checkbox-captcha";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowLeft,
  AlertCircle,
  MailCheck,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/layout/logo";
import {
  useAuth,
  setFlash,
  takeFlash,
  type AccountRole,
} from "@/components/auth/auth-context";
import { categories, type CategorySlug } from "@/lib/data";
import { sendEmail, verificationCodeEmail } from "@/lib/email";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

// Tour packages are added by travel companies, not registered as their own
// partner type — so exclude "tours" (and the generic "more") from signup.
const partnerCategories = [
  ...categories.filter((c) => c.slug !== "more" && c.slug !== "tours"),
  // Roadside Assistance registers as a single partner type (not one per service).
  { slug: "roadside", name: "Roadside Assistance" } as (typeof categories)[number],
  // Co-working spaces for remote workers / freelancers.
  { slug: "coworking", name: "Co-working Space" } as (typeof categories)[number],
];

const benefits = [
  "Book hotels, tours, transport & guides in one place",
  "Trusted local partners across Gilgit Baltistan",
  "Best-price guarantee with 24/7 support",
];

export function AuthForm({ mode }: { mode: Mode }) {
  const isSignup = mode === "signup";
  const router = useRouter();
  const {
    register,
    verifyCode,
    resendCode,
    requestPasswordReset,
    resetPassword,
    login,
  } = useAuth();

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<AccountRole>("traveler");
  const [businessCategory, setBusinessCategory] = React.useState<CategorySlug | "">(
    ""
  );
  const [showPw, setShowPw] = React.useState(false);
  const [error, setError] = React.useState("");
  const [flash, setFlashMsg] = React.useState("");

  // Email verification state
  const [verifyEmail, setVerifyEmail] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [verifyMsg, setVerifyMsg] = React.useState("");
  const [verifyError, setVerifyError] = React.useState("");
  const [devCode, setDevCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [captcha, setCaptcha] = React.useState(false);

  // Forgot-password state
  const [forgotOpen, setForgotOpen] = React.useState(false);
  const [forgotStep, setForgotStep] = React.useState<"email" | "reset">("email");
  const [newPassword, setNewPassword] = React.useState("");

  // Where to go after a successful sign-in (e.g. back to the booking page).
  const [redirectTo, setRedirectTo] = React.useState("");
  React.useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("redirect");
    if (p) setRedirectTo(p);
  }, []);
  const redirectQS = redirectTo
    ? `?redirect=${encodeURIComponent(redirectTo)}`
    : "";
  const goAfterAuth = () => router.push(redirectTo || "/dashboard");

  React.useEffect(() => {
    const msg = takeFlash();
    if (msg) setFlashMsg(msg);
  }, []);

  const startVerification = (toEmail: string, toName: string, newCode: string) => {
    setVerifyEmail(toEmail);
    setVerifyMsg(`We sent a 6-digit code to ${toEmail}.`);
    setVerifyError("");
    setDevCode("");
    setCode("");
    sendEmail(
      toEmail,
      "Verify your Rego email",
      verificationCodeEmail({ name: toName || "there", code: newCode })
    ).then((ok) => {
      if (!ok) setDevCode(newCode);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!captcha) {
      setError("Please confirm you're not a robot.");
      return;
    }
    // Defense-in-depth throttle: max 5 attempts per 5 min per action+email.
    const gate = clientThrottle(
      `${isSignup ? "signup" : "login"}:${email.trim().toLowerCase()}`,
      5,
      5 * 60_000
    );
    if (!gate.ok) {
      setError(`Too many attempts. Please wait ${gate.retryAfter}s and try again.`);
      return;
    }
    setBusy(true);
    try {
      if (isSignup) {
        if (role === "partner" && !businessCategory) {
          setError("Please select the category you want to register under.");
          setBusy(false);
          return;
        }
        await register(
          name,
          email,
          password,
          role,
          role === "partner" ? (businessCategory as CategorySlug) : undefined
        );
      } else {
        await login(email, password);
      }
      goAfterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyEmail) return;
    setVerifyError("");
    setBusy(true);
    try {
      verifyCode(verifyEmail, code);
      setBusy(false);
      setFlash("Email verified! You can now sign in.");
      setVerifyEmail(null);
      router.push(`/signin${redirectQS}`);
    } catch (err) {
      setBusy(false);
      setVerifyError(err instanceof Error ? err.message : "Invalid code.");
    }
  };

  const handleResend = async () => {
    if (!verifyEmail) return;
    try {
      await resendCode(verifyEmail);
      startVerification(verifyEmail, name, "");
      setVerifyMsg(`A new code was sent to ${verifyEmail}.`);
    } catch {
      setVerifyError("Could not resend the code.");
    }
  };

  const openForgot = () => {
    setForgotOpen(true);
    setForgotStep("email");
    setVerifyError("");
    setVerifyMsg("");
    setDevCode("");
    setCode("");
    setNewPassword("");
  };

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError("");
    setVerifyMsg("");
    try {
      await requestPasswordReset(email);
      // Supabase sends a secure reset link by email; no in-app code step.
      setVerifyMsg(
        `If an account exists for ${email}, we've emailed a password reset link. Open it to set a new password.`
      );
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  const handleForgotReset = (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError("");
    try {
      resetPassword(email, code, newPassword);
      setFlash("Password updated! Please sign in.");
      setForgotOpen(false);
      router.push(`/signin${redirectQS}`);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Could not reset.");
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden lg:block">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://picsum.photos/seed/mountains-lake-turquoise11/1200/1600')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-forest-900/80 via-forest-900/70 to-forest-900/90" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/" className="flex items-center">
            <BrandLogo className="h-16 w-auto" />
          </Link>

          <div>
            <p className="font-script text-3xl text-gold">Explore The Beauty of</p>
            <h2 className="font-display text-4xl font-extrabold leading-tight text-white">
              GILGIT BALTISTAN
            </h2>
            <ul className="mt-8 space-y-3">
              {benefits.map((b) => (
                <li key={b} className="flex items-center gap-3 text-white/90">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-gold" />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-sm text-white/60">
            © {new Date().getFullYear()} Rego. All rights reserved.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-start justify-center bg-background px-6 pb-10 pt-0 lg:items-center lg:px-6 lg:py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Mobile: full-width green header — back link (white) + logo */}
          <div className="-mx-6 mb-8 bg-gradient-forest px-6 pb-7 pt-8 lg:hidden">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm font-medium text-white/90 transition-colors hover:text-gold"
            >
              <ArrowLeft className="h-4 w-4" /> Back to home
            </Link>
            <Link href="/" aria-label="Rego home" className="mt-5 flex justify-center">
              <BrandLogo className="h-16 w-auto" />
            </Link>
          </div>

          {verifyEmail ? (
            <div>
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-forest-50 text-forest-600">
                <MailCheck className="h-7 w-7" />
              </span>
              <h1 className="mt-5 font-display text-3xl font-bold text-forest">
                Verify your email
              </h1>
              <p className="mt-2 text-muted-foreground">
                Enter the 6-digit code we sent to{" "}
                <span className="font-semibold text-forest">{verifyEmail}</span>.
              </p>

              {verifyMsg && !devCode && (
                <div className="mt-6 flex items-center gap-2 rounded-xl border border-forest-200 bg-forest-50 px-4 py-3 text-sm font-medium text-forest-600">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  {verifyMsg}
                </div>
              )}
              {devCode && (
                <div className="mt-6 rounded-xl border border-gold-300 bg-gold-50 px-4 py-3 text-sm text-gold-700">
                  <p className="font-semibold">Email couldn&apos;t be delivered.</p>
                  <p className="mt-0.5">
                    Resend test mode only sends to your own address. For testing,
                    your code is:
                  </p>
                  <p className="mt-1 font-display text-xl font-bold tracking-[0.3em] text-forest">
                    {devCode}
                  </p>
                </div>
              )}
              {verifyError && (
                <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  {verifyError}
                </div>
              )}

              <form onSubmit={handleVerify} className="mt-6 space-y-4">
                <input
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  inputMode="numeric"
                  placeholder="••••••"
                  className="w-full rounded-xl border border-border bg-white px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] text-forest focus:border-forest-600 focus:outline-none"
                />
                <Button
                  type="submit"
                  variant="gold"
                  size="lg"
                  className="w-full rounded-lg bg-forest-600 text-white hover:bg-forest-700"
                  disabled={busy || code.length < 6}
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
                    </>
                  ) : (
                    "Verify email"
                  )}
                </Button>
              </form>

              <p className="mt-5 text-center text-sm text-muted-foreground">
                Didn&apos;t get it?{" "}
                <button
                  onClick={handleResend}
                  className="font-semibold text-forest-600 hover:text-gold"
                >
                  Resend code
                </button>
              </p>
              <p className="mt-2 text-center text-sm">
                <button
                  onClick={() => setVerifyEmail(null)}
                  className="text-muted-foreground hover:text-forest"
                >
                  Back
                </button>
              </p>
            </div>
          ) : forgotOpen ? (
            <div>
              <h1 className="font-display text-3xl font-bold text-forest">
                Reset your password
              </h1>
              <p className="mt-2 text-muted-foreground">
                {forgotStep === "email"
                  ? "Enter your email and we'll send a reset code."
                  : `Enter the code sent to ${email} and your new password.`}
              </p>

              {verifyMsg && !devCode && (
                <div className="mt-6 flex items-center gap-2 rounded-xl border border-forest-200 bg-forest-50 px-4 py-3 text-sm font-medium text-forest-600">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  {verifyMsg}
                </div>
              )}
              {devCode && (
                <div className="mt-6 rounded-xl border border-gold-300 bg-gold-50 px-4 py-3 text-sm text-gold-700">
                  <p className="font-semibold">Email couldn&apos;t be delivered.</p>
                  <p className="mt-0.5">For testing, your reset code is:</p>
                  <p className="mt-1 font-display text-xl font-bold tracking-[0.3em] text-forest">
                    {devCode}
                  </p>
                </div>
              )}
              {verifyError && (
                <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  {verifyError}
                </div>
              )}

              {forgotStep === "email" ? (
                <form onSubmit={handleForgotRequest} className="mt-6 space-y-4">
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-3 focus-within:border-forest-600">
                    <Mail className="h-5 w-5 shrink-0 text-forest-600" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="gold"
                    size="lg"
                    className="w-full rounded-lg bg-forest-600 text-white hover:bg-forest-700"
                  >
                    Send reset code
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleForgotReset} className="mt-6 space-y-4">
                  <input
                    value={code}
                    onChange={(e) =>
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    inputMode="numeric"
                    placeholder="6-digit code"
                    className="w-full rounded-xl border border-border bg-white px-4 py-3 text-center text-lg font-bold tracking-[0.4em] text-forest focus:border-forest-600 focus:outline-none"
                  />
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-3 focus-within:border-forest-600">
                    <Lock className="h-5 w-5 shrink-0 text-forest-600" />
                    <input
                      type="password"
                      required
                      minLength={4}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password"
                      className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none"
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="gold"
                    size="lg"
                    className="w-full rounded-lg bg-forest-600 text-white hover:bg-forest-700"
                    disabled={code.length < 6 || newPassword.length < 4}
                  >
                    Update password
                  </Button>
                </form>
              )}

              <p className="mt-4 text-center text-sm">
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  className="text-muted-foreground hover:text-forest"
                >
                  Back to sign in
                </button>
              </p>
            </div>
          ) : (
            <>
          <h1 className="font-display text-3xl font-bold text-forest">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {isSignup
              ? "Join Rego to book your perfect trip across Gilgit Baltistan."
              : "Sign in to continue planning your journey."}
          </p>

          {flash && (
            <div className="mt-6 flex items-center gap-2 rounded-xl border border-forest-200 bg-forest-50 px-4 py-3 text-sm font-medium text-forest-600">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              {flash}
            </div>
          )}

          {error && (
            <div role="alert" className="mt-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {isSignup && (
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-forest">
                  I want to register as
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole("traveler")}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-sm font-semibold transition-colors",
                      role === "traveler"
                        ? "border-forest-600 bg-forest-50 text-forest"
                        : "border-border bg-white text-forest/60 hover:border-forest/40"
                    )}
                  >
                    Traveler
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      Book trips
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("partner")}
                    className={cn(
                      "rounded-xl border px-4 py-3 text-sm font-semibold transition-colors",
                      role === "partner"
                        ? "border-forest-600 bg-forest-50 text-forest"
                        : "border-border bg-white text-forest/60 hover:border-forest/40"
                    )}
                  >
                    Business / Partner
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      List my service
                    </span>
                  </button>
                </div>
              </div>
            )}

            {isSignup && role === "partner" && (
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-forest">
                  Business category
                </label>
                <select
                  value={businessCategory}
                  onChange={(e) =>
                    setBusinessCategory(e.target.value as CategorySlug)
                  }
                  className="auth-input"
                >
                  <option value="" disabled>
                    Select what you offer (Hotel, Transport…)
                  </option>
                  {partnerCategories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isSignup && (
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-forest">
                  {role === "partner" ? "Business / contact name" : "Full name"}
                </label>
                <div className="flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-3 focus-within:border-forest-600 focus-within:ring-2 focus-within:ring-forest-600/25">
                  <User className="h-5 w-5 shrink-0 text-forest-600" />
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-forest">
                Email address
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-3 focus-within:border-forest-600 focus-within:ring-2 focus-within:ring-forest-600/25">
                <Mail className="h-5 w-5 shrink-0 text-forest-600" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  autoCapitalize="none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-forest">
                Password
              </label>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-3 focus-within:border-forest-600 focus-within:ring-2 focus-within:ring-forest-600/25">
                <Lock className="h-5 w-5 shrink-0 text-forest-600" />
                <input
                  type={showPw ? "text" : "password"}
                  required
                  minLength={4}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent text-sm text-forest placeholder:text-muted-foreground focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="rounded-md text-muted-foreground transition-colors hover:text-forest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
                >
                  {showPw ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {!isSignup && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={openForgot}
                  className="rounded-md text-sm font-medium text-forest-600 transition-colors hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <CheckboxCaptcha checked={captcha} onChange={setCaptcha} />

            <Button
              type="submit"
              variant="gold"
              size="lg"
              disabled={busy || !captcha}
              aria-busy={busy}
              className="w-full gap-2 rounded-lg bg-forest-600 text-white hover:bg-forest-700 disabled:opacity-70"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? (isSignup ? "Creating account…" : "Signing in…") : isSignup ? "Create account" : "Sign in"}
            </Button>

          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
            <Link
              href={`${isSignup ? "/signin" : "/signup"}${redirectQS}`}
              className="font-semibold text-forest-600 hover:text-gold"
            >
              {isSignup ? "Sign in" : "Sign up"}
            </Link>
          </p>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}

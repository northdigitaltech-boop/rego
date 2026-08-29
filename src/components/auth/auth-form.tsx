"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clientThrottle } from "@/lib/client-throttle";
import { CheckboxCaptcha } from "@/components/auth/checkbox-captcha";
import {
  Turnstile,
  isTurnstileEnabled,
  type TurnstileHandle,
} from "@/components/auth/turnstile";
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
import { type CategorySlug } from "@/lib/data";
import { checkSignupEmail } from "@/lib/email-validation";
import { sendEmail, verificationCodeEmail } from "@/lib/email";
import { CategoryPicker } from "@/components/auth/category-picker";
import { partnerCategory, STASHED_CATEGORY_KEY } from "@/lib/partner-categories";
import { cn } from "@/lib/utils";
import { friendlyAuthError } from "@/lib/auth-errors";
import { reportSecurity } from "@/lib/security-report";

type Mode = "signin" | "signup";

/** Google's mark, inline so the button needs no network request. */
function GoogleMark() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

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
    loginWithGoogle,
  } = useAuth();

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<AccountRole>("traveler");

  /* Partner signup is two steps: what you offer, then your account.
   *
   * Only for partners. A traveller has no category to choose, so splitting
   * their signup would add a screen that asks nothing.
   *
   * The first step is deliberately the easy one. Someone who has tapped a
   * card has started, and people finish what they have started far more
   * often than they begin something that opens with a password field. */
  const [step, setStep] = React.useState<1 | 2>(1);
  const partnerPicking = isSignup && role === "partner" && step === 1;
  const [businessCategory, setBusinessCategory] = React.useState<CategorySlug | "">(
    ""
  );
  /** The card they tapped, for the summary shown on step 2. */
  const chosen = partnerCategory(businessCategory);
  const [showPw, setShowPw] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  // Live email hygiene feedback while typing (signup only).
  const emailCheck =
    isSignup && email.trim().length > 3 ? checkSignupEmail(email) : { ok: true as const };
  const [flash, setFlashMsg] = React.useState("");

  // Email verification state
  const [verifyEmail, setVerifyEmail] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [verifyMsg, setVerifyMsg] = React.useState("");
  const [verifyError, setVerifyError] = React.useState("");
  const [devCode, setDevCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [captcha, setCaptcha] = React.useState(false);

  // Cloudflare Turnstile. When NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set we fall
  // back to the simple checkbox, so the form keeps working either way.
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null);
  const turnstileRef = React.useRef<TurnstileHandle | null>(null);
  const humanOk = isTurnstileEnabled ? Boolean(turnstileToken) : captcha;

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
    setNotice("");
    if (!humanOk) {
      setError(
        isTurnstileEnabled
          ? "Please complete the security check below."
          : "Please confirm you're not a robot."
      );
      return;
    }
    // Block fake / disposable emails at signup.
    if (isSignup) {
      const check = checkSignupEmail(email);
      if (!check.ok) {
        setError(check.error ?? "Please enter a valid email address.");
        return;
      }
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
          role === "partner" ? (businessCategory as CategorySlug) : undefined,
          turnstileToken ?? undefined
        );
      } else {
        await login(email, password, turnstileToken ?? undefined);
      }
      // Security telemetry — never blocks the redirect.
      reportSecurity("login_success", {
        email: email.trim().toLowerCase(),
      });
      goAfterAuth();
    } catch (err) {
      // Turnstile tokens are single-use — issue a fresh one for the next try.
      turnstileRef.current?.reset();
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      // Supabase requires the address to be confirmed → show a friendly notice
      // instead of a red error, since the signup itself succeeded.
      if (msg.startsWith("CONFIRM_EMAIL:")) {
        setNotice(msg.slice("CONFIRM_EMAIL:".length));
        setError("");
      } else {
        // Translate Supabase's terse wording into something actionable.
        setError(friendlyAuthError(msg).message);
        reportSecurity("login_failed", {
          email: email.trim().toLowerCase(),
          // The classified reason, never the raw credential or provider text.
          detail: isSignup ? "signup" : "signin",
        });
      }
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
            <p className="font-script text-3xl text-gold">Your complete</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold leading-[1.15] tracking-[0.01em] text-white">
              GILGIT BALTISTAN TOURISM MARKETPLACE
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

          {notice && (
            <div role="status" className="mt-6 flex items-start gap-2 rounded-xl border border-forest-200 bg-forest-50 px-4 py-3 text-sm font-medium text-forest-700">
              <Mail className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                {notice}
                <span className="mt-1 block text-xs font-normal text-forest-700/80">
                  Can&apos;t find it? Check your spam folder.
                </span>
              </span>
            </div>
          )}

          {/* Google first: it skips the confirm-email step entirely, which is
              where most signups are lost. */}
          <button
            type="button"
            onClick={async () => {
              setError("");
              /* Carry the chosen category across the redirect. Google takes
                 the page away, so nothing in React state survives; the
                 role-setup screen reads this back rather than asking the
                 same question a second time. */
              try {
                if (isSignup && role === "partner" && businessCategory) {
                  sessionStorage.setItem(STASHED_CATEGORY_KEY, businessCategory);
                }
              } catch {
                /* Storage unavailable. They will be asked again — mildly
                   annoying, not broken. */
              }
              try {
                await loginWithGoogle(redirectTo || undefined);
              } catch (err) {
                setError(
                  friendlyAuthError(
                    err instanceof Error ? err.message : "Could not reach Google."
                  ).message
                );
              }
            }}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-white px-4 py-3 text-sm font-semibold text-forest transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600"
          >
            <GoogleMark />
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted-foreground">
              or use your email
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-forest">
                  I want to register as
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRole("traveler");
                      /* A traveller has no step 1, so leaving `step` at 2
                         from a previous partner visit would strand them. */
                      setStep(1);
                    }}
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
                    onClick={() => {
                      setRole("partner");
                      setStep(1);
                    }}
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

            {/* STEP 1 — what do you offer. Cards, not a <select>: someone
                unsure whether they are a "Travel Company" or a "Tour Guide"
                can see both at once instead of scrolling a native picker
                back and forth. */}
            {partnerPicking && (
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-forest">
                  What do you offer?
                </label>
                <CategoryPicker
                  value={businessCategory}
                  onChange={(slug) => {
                    setBusinessCategory(slug as CategorySlug);
                    setError("");
                  }}
                />
                <button
                  type="button"
                  disabled={!businessCategory}
                  onClick={() => setStep(2)}
                  className="mt-4 w-full rounded-xl bg-gradient-forest px-4 py-3 text-sm font-semibold text-white shadow-soft transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  Continue
                </button>
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  You can add more services later.
                </p>
              </div>
            )}

            {/* STEP 2 — a reminder of what they picked, and the way back.
                Without this, "Business / Partner" is the only thing on
                screen telling them what account they are creating. */}
            {isSignup && role === "partner" && step === 2 && chosen && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-left transition-colors hover:bg-muted"
              >
                <chosen.icon className="h-5 w-5 shrink-0 text-forest-600" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-forest">
                    {chosen.name}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Registering as this
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-forest-600 underline">
                  Change
                </span>
              </button>
            )}

            {isSignup && !partnerPicking && (
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

            {/* STEP 2 — the account itself. Hidden while a partner is still
                choosing what they offer: a password field next to that
                question is exactly the wall the two steps exist to remove. */}
            {!partnerPicking && (
              <>
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
              {/* Live fake / disposable / typo feedback (signup only) */}
              {isSignup && !emailCheck.ok && (
                <p className="mt-1.5 text-xs font-semibold text-red-600">
                  {emailCheck.error}
                  {emailCheck.suggestion && (
                    <button
                      type="button"
                      onClick={() => setEmail(emailCheck.suggestion!)}
                      className="ml-1 underline hover:text-forest"
                    >
                      Use it
                    </button>
                  )}
                </p>
              )}
              {isSignup && emailCheck.ok && (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Use a real email — you&apos;ll need it to verify your account and receive bookings.
                </p>
              )}
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

            {isTurnstileEnabled ? (
              <Turnstile
                ref={turnstileRef}
                action={isSignup ? "signup" : "signin"}
                onToken={setTurnstileToken}
              />
            ) : (
              <CheckboxCaptcha checked={captcha} onChange={setCaptcha} />
            )}

            <Button
              type="submit"
              variant="gold"
              size="lg"
              disabled={busy || !humanOk}
              aria-busy={busy}
              className="w-full gap-2 rounded-lg bg-forest-600 text-white hover:bg-forest-700 disabled:opacity-70"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? (isSignup ? "Creating account…" : "Signing in…") : isSignup ? "Create account" : "Sign in"}
            </Button>

              </>
            )}
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

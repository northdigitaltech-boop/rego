"use client";

import * as React from "react";

import { supabase } from "@/lib/supabase";
import { type CategorySlug } from "@/lib/data";
import { checkSignupEmail } from "@/lib/email-validation";
import { notifyWelcome } from "@/lib/notify-events";
import { clearStaffProfileCache } from "@/lib/staff-portal";

export type AccountRole = "traveler" | "partner" | "admin";

export interface User {
  name: string;
  email: string;
  role: AccountRole;
  businessCategory?: CategorySlug;
  avatar?: string;
  /**
   * False when the account was created without ever picking a role — which
   * is every Google sign-up, because Google only tells us name and email.
   * Those users are asked once, on first visit, before they see the app.
   */
  roleChosen: boolean;
}

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  register: (
    name: string,
    email: string,
    password: string,
    role: AccountRole,
    businessCategory?: CategorySlug,
    /** Cloudflare Turnstile token — verified by Supabase, not by us. */
    captchaToken?: string
  ) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  resendCode: (email: string) => Promise<void>;
  requestPasswordReset: (email: string, captchaToken?: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  updateProfile: (updates: { name?: string; avatar?: string }) => Promise<void>;
  login: (email: string, password: string, captchaToken?: string) => Promise<void>;
  /** Google OAuth. Redirects away, so it never resolves on success. */
  loginWithGoogle: (redirectTo?: string) => Promise<void>;
  /** Record the role an OAuth user picks on their first visit. */
  chooseRole: (role: AccountRole, businessCategory?: CategorySlug) => Promise<void>;
  loginAsGuest: () => void;
  logout: () => Promise<void>;
}

const FLASH_KEY = "safarigb_flash";
const GUEST_KEY = "safarigb_guest";

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function setFlash(message: string) {
  try {
    localStorage.setItem(FLASH_KEY, message);
  } catch {
    /* ignore */
  }
}

export function takeFlash(): string | null {
  try {
    const msg = localStorage.getItem(FLASH_KEY);
    if (msg) localStorage.removeItem(FLASH_KEY);
    return msg;
  } catch {
    return null;
  }
}

function mapRole(r?: string | null): AccountRole {
  if (r === "admin") return "admin";
  if (r === "partner") return "partner";
  return "traveler";
}

interface SupaUser {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

/**
 * True when Supabase has verified the address (the user clicked the link we
 * emailed them). Accounts created before "Confirm email" was switched on are
 * already stamped confirmed, so this only blocks genuinely unverified ones.
 */
function isEmailConfirmed(su: SupaUser): boolean {
  return Boolean(su.email_confirmed_at || su.confirmed_at);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [ready, setReady] = React.useState(false);

  const hydrate = React.useCallback(async (su: SupaUser | null | undefined) => {
    if (!su) {
      // No Supabase session — fall back to a local guest session if one exists.
      try {
        const g = localStorage.getItem(GUEST_KEY);
        if (g) {
          setUser(JSON.parse(g));
          return;
        }
      } catch {
        /* ignore */
      }
      setUser(null);
      return;
    }
    // Hard gate: an unverified address is not a usable account. Sign the
    // session straight back out so unconfirmed users can never reach the app.
    if (!isEmailConfirmed(su)) {
      await supabase.auth.signOut().catch(() => {});
      setUser(null);
      return;
    }

    const meta = su.user_metadata ?? {};
    let role = (meta.role as string) ?? "traveler";
    let fullName = (meta.full_name as string) ?? "";
    let avatar = (meta.avatar as string) ?? "";
    let biz = (meta.business_category as string) ?? "";
    try {
      const { data } = await supabase
        .from("profiles")
        .select("role, full_name, avatar, business_category")
        .eq("id", su.id)
        .maybeSingle();
      if (data) {
        const d = data as { role?: string; full_name?: string; avatar?: string; business_category?: string };
        role = d.role ?? role;
        fullName = d.full_name || fullName;
        avatar = d.avatar ?? avatar;
        biz = d.business_category ?? biz;
      }
    } catch {
      /* profile fetch failed — fall back to metadata */
    }
    setUser({
      name: fullName || su.email || "",
      email: su.email ?? "",
      role: mapRole(role),
      businessCategory: (biz as CategorySlug) || undefined,
      avatar: avatar || undefined,
      // Email signup always writes `role` into user metadata; OAuth never
      // does. Its absence is what tells us to ask.
      roleChosen: Boolean(meta.role),
    });
  }, []);

  React.useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      hydrate((data.session?.user as SupaUser) ?? null).finally(() => {
        if (active) setReady(true);
      });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrate((session?.user as SupaUser) ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [hydrate]);

  const register = React.useCallback(
    async (
      name: string,
      email: string,
      password: string,
      role: AccountRole,
      businessCategory?: CategorySlug,
      captchaToken?: string
    ) => {
      const e = email.trim().toLowerCase();

      // Reject fake / disposable / placeholder addresses before hitting the API.
      const check = checkSignupEmail(e);
      if (!check.ok) throw new Error(check.error ?? "Please enter a valid email address.");

      const { data, error } = await supabase.auth.signUp({
        email: e,
        password,
        options: {
          // Where Supabase sends the user after they click the confirm link.
          emailRedirectTo:
            typeof window !== "undefined" ? `${window.location.origin}/signin` : undefined,
          captchaToken,
          data: {
            full_name: name.trim(),
            role,
            business_category: businessCategory ?? null,
          },
        },
      });
      if (error) throw new Error(error.message);

      // Welcome mail + in-app greeting, sent automatically. Fire-and-forget:
      // a failed welcome must never block the registration itself.
      notifyWelcome({
        email: e,
        name: name.trim(),
        isPartner: role === "partner",
      });

      // When "Confirm email" is ON in Supabase, signUp returns a user but NO
      // session — the address must be verified first. Tell the user to check
      // their inbox instead of silently failing to sign in.
      if (data.user && !data.session) {
        throw new Error(
          `CONFIRM_EMAIL:We've sent a confirmation link to ${e}. Please open it to activate your account.`
        );
      }

      /* ------------------------------------------------------------------
         ALREADY SIGNED IN — DO NOT SIGN IN AGAIN.

         When "Confirm email" is OFF, signUp returns a SESSION as well as a
         user. The account is created and the browser is authenticated; there
         is nothing left to do.

         This used to call signInWithPassword() here regardless, on the
         assumption — written in the comment that was here — that the line was
         unreachable because confirmation was on. It was reachable, and it
         failed every time: Supabase enforces captcha on /token as well as
         /signup, the Turnstile token is single-use and was already spent on
         the signup, so the follow-up sign-in arrived with no token and came
         back "400 captcha protection: request disallowed (no captcha_token
         found)".

         The visible result was the worst kind: the account WAS created, and
         the person was told the security check failed. Trying again then said
         "User already registered".
         ------------------------------------------------------------------ */
      if (data.session) {
        try {
          localStorage.removeItem(GUEST_KEY);
        } catch {
          /* ignore */
        }
        return;
      }

      /* No user and no session, with no error raised. Nothing to sign in as,
         so say so rather than calling /token and getting the captcha refusal
         in place of the real reason. */
      throw new Error("We couldn't complete the signup. Please try again.");
    },
    []
  );

  const login = React.useCallback(
    async (email: string, password: string, captchaToken?: string) => {
    const e = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: e,
      password,
      options: { captchaToken },
    });
    if (error) throw new Error(error.message);

    // Refuse unverified accounts with a clear, actionable message.
    if (data.user && !isEmailConfirmed(data.user as SupaUser)) {
      await supabase.auth.signOut().catch(() => {});
      throw new Error(
        `CONFIRM_EMAIL:Your email isn't verified yet. Please open the confirmation link we sent to ${e}.`
      );
    }
    try {
      localStorage.removeItem(GUEST_KEY);
    } catch {
      /* ignore */
    }
    },
    []
  );

  /**
   * Sign in with Google. A Google account is already verified, so these users
   * skip the confirm-email step entirely — which removes the single biggest
   * drop-off point in the signup flow.
   */
  const loginWithGoogle = React.useCallback(async (redirectTo?: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const next = redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : "";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/signin${next}`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) throw new Error(error.message);
  }, []);

  /**
   * Finish setting up an account that arrived via Google.
   *
   * ---------------------------------------------------------------------------
   * WHY THIS GOES THROUGH A SERVER ROUTE
   *
   * This used to write profiles.role straight from the browser. Since
   * phase130 that update is rejected — guard_profile_role_change() refuses
   * any role change by a non-admin, which is exactly what stops a signup
   * payload from minting an administrator.
   *
   * The rejection was thrown away: the update's error was never read, while
   * the auth.updateUser() beside it succeeded. So roleChosen flipped to true,
   * RoleSetupGate stopped asking, and profiles.role stayed 'customer'. Since
   * hydrate() prefers the profiles row, anyone who picked Partner was quietly
   * turned into a traveller — permanently, with no error anywhere.
   *
   * /api/auth/choose-role does both writes with the service role, which the
   * trigger exempts, and it can only ever set traveller or partner.
   * ---------------------------------------------------------------------------
   */
  const chooseRole = React.useCallback(
    async (role: AccountRole, businessCategory?: CategorySlug) => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error("Please sign in again.");

      const res = await fetch("/api/auth/choose-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role, businessCategory: businessCategory ?? null }),
      });

      const out = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;
      if (!res.ok || !out?.ok) {
        throw new Error(out?.error ?? "Could not save your account type.");
      }

      /* The server changed the metadata, so this browser's cached user is
         stale. Ask Supabase for a fresh copy before re-hydrating, or the
         gate re-renders against the old role and asks again. */
      const { data: fresh } = await supabase.auth.getUser();
      await hydrate((fresh.user as SupaUser) ?? null);
    },
    [hydrate]
  );

  // Email confirmation is handled by Supabase, so these are no-ops kept for API compatibility.
  const verifyCode = React.useCallback(async (_email: string, _code: string) => {}, []);
  const resendCode = React.useCallback(async (_email: string) => {}, []);

  /* Goes to Rego's own route, not to supabase.auth.resetPasswordForEmail().
     That call asks SUPABASE to send the mail, and it answered "Error sending
     recovery email" — the built-in service is rate-limited to a handful an
     hour and, without custom SMTP, does not reliably reach addresses outside
     the project team. The route generates the same one-time link and posts it
     through the SMTP that already sends booking confirmations.

     The captcha token still travels, and is still verified — by the route
     now, against Cloudflare, because bypassing Supabase's mailer also
     bypasses the check Supabase was performing. */
  const requestPasswordReset = React.useCallback(
    async (email: string, captchaToken?: string) => {
      const res = await fetch("/api/auth/reset-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), captchaToken }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Could not send the reset link.");
      }
    },
    []
  );

  const resetPassword = React.useCallback(
    async (_email: string, _code: string, newPassword: string) => {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
    },
    []
  );

  const updateProfile = React.useCallback(
    async (updates: { name?: string; avatar?: string }) => {
      const { data: sess } = await supabase.auth.getSession();
      const su = sess.session?.user;
      if (!su) {
        // guest — just update local state
        setUser((cur) => (cur ? { ...cur, ...updates } : cur));
        return;
      }
      const meta: Record<string, unknown> = {};
      const prof: Record<string, unknown> = {};
      if (updates.name !== undefined) {
        meta.full_name = updates.name;
        prof.full_name = updates.name;
      }
      if (updates.avatar !== undefined) {
        meta.avatar = updates.avatar;
        prof.avatar = updates.avatar;
      }
      try {
        await supabase.auth.updateUser({ data: meta });
        await supabase.from("profiles").update(prof).eq("id", su.id);
      } catch {
        /* ignore */
      }
      setUser((cur) => (cur ? { ...cur, ...updates } : cur));
    },
    []
  );

  const loginAsGuest = React.useCallback(() => {
    const g: User = {
      name: "Guest Traveler",
      email: "guest@rego.com",
      role: "traveler",
      roleChosen: true,
    };
    try {
      localStorage.setItem(GUEST_KEY, JSON.stringify(g));
    } catch {
      /* ignore */
    }
    setUser(g);
  }, []);

  const logout = React.useCallback(async () => {
    try {
      localStorage.removeItem(GUEST_KEY);
    } catch {
      /* ignore */
    }
    /* The staff record is cached for the tab. Without this, the next person
       to sign in on a shared computer would be shown the previous one's
       portal until the tab was closed. */
    clearStaffProfileCache();
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        ready,
        register,
        verifyCode,
        resendCode,
        requestPasswordReset,
        resetPassword,
        updateProfile,
        login,
        loginWithGoogle,
        chooseRole,
        loginAsGuest,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

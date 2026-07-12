"use client";

import * as React from "react";

import { supabase } from "@/lib/supabase";
import { type CategorySlug } from "@/lib/data";

export type AccountRole = "traveler" | "partner" | "admin";

export interface User {
  name: string;
  email: string;
  role: AccountRole;
  businessCategory?: CategorySlug;
  avatar?: string;
}

interface AuthContextValue {
  user: User | null;
  ready: boolean;
  register: (
    name: string,
    email: string,
    password: string,
    role: AccountRole,
    businessCategory?: CategorySlug
  ) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  resendCode: (email: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<void>;
  updateProfile: (updates: { name?: string; avatar?: string }) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
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
  user_metadata?: Record<string, unknown> | null;
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
      businessCategory?: CategorySlug
    ) => {
      const e = email.trim().toLowerCase();
      const { error } = await supabase.auth.signUp({
        email: e,
        password,
        options: {
          data: {
            full_name: name.trim(),
            role,
            business_category: businessCategory ?? null,
          },
        },
      });
      if (error) throw new Error(error.message);
      // Email confirmation is disabled, so sign in immediately.
      const { error: e2 } = await supabase.auth.signInWithPassword({ email: e, password });
      if (e2) throw new Error(e2.message);
      try {
        localStorage.removeItem(GUEST_KEY);
      } catch {
        /* ignore */
      }
    },
    []
  );

  const login = React.useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw new Error(error.message);
    try {
      localStorage.removeItem(GUEST_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // Email confirmation is handled by Supabase, so these are no-ops kept for API compatibility.
  const verifyCode = React.useCallback(async (_email: string, _code: string) => {}, []);
  const resendCode = React.useCallback(async (_email: string) => {}, []);

  const requestPasswordReset = React.useCallback(async (email: string) => {
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo,
    });
    if (error) throw new Error(error.message);
  }, []);

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
    const g: User = { name: "Guest Traveler", email: "guest@rego.com", role: "traveler" };
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

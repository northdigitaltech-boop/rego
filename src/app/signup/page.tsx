import type { Metadata } from "next";

import { AuthForm } from "@/components/auth/auth-form";

export const metadata: Metadata = {
  title: "Sign up",
  description: "Create your Rego account to book trips across Gilgit Baltistan.",
};

export default function SignUpPage() {
  return <AuthForm mode="signup" />;
}

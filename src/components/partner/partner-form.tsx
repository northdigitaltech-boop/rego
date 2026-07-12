"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { categories } from "@/lib/data";
import { locations } from "@/lib/data";

export function PartnerForm() {
  const [submitted, setSubmitted] = React.useState(false);

  if (submitted) {
    return (
      <div className="rounded-3xl border border-border/70 bg-forest-50/60 p-8 text-center shadow-premium">
        <CheckCircle2 className="mx-auto h-12 w-12 text-forest-600" />
        <h3 className="mt-4 font-display text-xl font-bold text-forest">
          Application received
        </h3>
        <p className="mt-2 text-muted-foreground">
          Thanks for your interest in partnering with Rego. Our team will
          review your details and reach out within 2 business days. (Demo — not
          connected to a backend yet.)
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => setSubmitted(false)}
        >
          Submit another
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
      }}
      className="space-y-4 rounded-3xl border border-border/70 bg-card p-6 shadow-premium sm:p-8"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Business name" required>
          <input
            type="text"
            required
            placeholder="e.g. Shangrila Resort"
            className="auth-input"
          />
        </FormField>
        <FormField label="Business type" required>
          <select required className="auth-input" defaultValue="">
            <option value="" disabled>
              Select a category
            </option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Contact name" required>
          <input type="text" required placeholder="Your name" className="auth-input" />
        </FormField>
        <FormField label="Location" required>
          <select required className="auth-input" defaultValue="">
            <option value="" disabled>
              Select location
            </option>
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Email address" required>
          <input
            type="email"
            required
            placeholder="you@example.com"
            className="auth-input"
          />
        </FormField>
        <FormField label="Phone number" required>
          <input
            type="tel"
            required
            placeholder="+92 3xx xxxxxxx"
            className="auth-input"
          />
        </FormField>
      </div>

      <FormField label="Tell us about your business">
        <textarea
          rows={4}
          placeholder="What do you offer? Where are you based?"
          className="auth-input resize-none"
        />
      </FormField>

      <Button
        type="submit"
        variant="gold"
        size="lg"
        className="w-full rounded-lg"
      >
        Submit application
      </Button>
    </form>
  );
}

function FormField({
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
      <span className="mb-1.5 block text-sm font-semibold text-forest">
        {label} {required && <span className="text-gold-600">*</span>}
      </span>
      {children}
    </label>
  );
}

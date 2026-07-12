import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1320px",
      },
    },
    extend: {
      colors: {
        border: "oklch(var(--border) / <alpha-value>)",
        input: "oklch(var(--input) / <alpha-value>)",
        ring: "oklch(var(--ring) / <alpha-value>)",
        background: "oklch(var(--background) / <alpha-value>)",
        foreground: "oklch(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "oklch(var(--primary) / <alpha-value>)",
          foreground: "oklch(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "oklch(var(--secondary) / <alpha-value>)",
          foreground: "oklch(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "oklch(var(--destructive) / <alpha-value>)",
          foreground: "oklch(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "oklch(var(--muted) / <alpha-value>)",
          foreground: "oklch(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "oklch(var(--accent) / <alpha-value>)",
          foreground: "oklch(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "oklch(var(--popover) / <alpha-value>)",
          foreground: "oklch(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "oklch(var(--card) / <alpha-value>)",
          foreground: "oklch(var(--card-foreground) / <alpha-value>)",
        },
        chart: {
          1: "oklch(var(--chart-1) / <alpha-value>)",
          2: "oklch(var(--chart-2) / <alpha-value>)",
          3: "oklch(var(--chart-3) / <alpha-value>)",
          4: "oklch(var(--chart-4) / <alpha-value>)",
          5: "oklch(var(--chart-5) / <alpha-value>)",
        },
        // Brand tokens — "forest" now renders the Pine Teal brand palette
        forest: {
          DEFAULT: "#006951",
          50: "#E6F2EF",
          100: "#C2E0D9",
          200: "#8FC8BB",
          300: "#57AD9A",
          400: "#2A907B",
          500: "#0E7A63",
          600: "#006951",
          700: "#005542",
          800: "#003F31",
          900: "#002A21",
        },
        gold: {
          DEFAULT: "#E5B94B",
          50: "#FDF8EC",
          100: "#FAEFCE",
          200: "#F4DF9D",
          300: "#EDCD6E",
          400: "#E5B94B",
          500: "#D6A22C",
          600: "#B68421",
          700: "#8E661C",
          800: "#664A18",
          900: "#3F2E10",
        },
        // Bright mint-teal accent (used for highlights & gradients)
        leaf: {
          DEFAULT: "#3FB8A0",
          50: "#E9F8F4",
          100: "#CDEFE7",
          200: "#9FE0D2",
          300: "#6FD0BD",
          400: "#4FC2AB",
          500: "#3FB8A0",
          600: "#2E9685",
          700: "#247568",
          800: "#1A574E",
          900: "#123C36",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
        "3xl": "calc(var(--radius) + 16px)",
        "4xl": "calc(var(--radius) + 24px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
        script: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-sans)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        soft: "0 4px 24px -8px rgba(0, 105, 81, 0.18)",
        card: "0 10px 40px -12px rgba(0, 105, 81, 0.22)",
        glow: "0 0 40px -8px rgba(229, 185, 75, 0.45)",
        // Premium layered shadows (teal-tinted)
        premium:
          "0 1px 2px rgba(0,105,81,0.06), 0 12px 32px -12px rgba(0,105,81,0.20)",
        "premium-lg":
          "0 2px 6px rgba(0,105,81,0.06), 0 24px 64px -20px rgba(0,105,81,0.30)",
        "gold-glow": "0 8px 30px -8px rgba(214,162,44,0.55)",
        "inner-top": "inset 0 1px 0 0 rgba(255,255,255,0.08)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-up": "fade-up 0.6s ease-out forwards",
        "fade-in": "fade-in 0.6s ease-out forwards",
        float: "float 6s ease-in-out infinite",
        shimmer: "shimmer 2s infinite",
      },
      backgroundImage: {
        "hero-radial":
          "radial-gradient(120% 120% at 50% 0%, rgba(15,76,58,0) 40%, rgba(15,76,58,0.55) 100%)",
        "gradient-forest":
          "linear-gradient(135deg, #0E7A63 0%, #006951 55%, #005542 100%)",
        "gradient-forest-deep":
          "linear-gradient(160deg, #005542 0%, #003F31 60%, #002A21 100%)",
        "gradient-gold":
          "linear-gradient(135deg, #EDCD6E 0%, #E5B94B 50%, #D6A22C 100%)",
        "gradient-leaf":
          "linear-gradient(120deg, #6FD0BD 0%, #3FB8A0 100%)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;

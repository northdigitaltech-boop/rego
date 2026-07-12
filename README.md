# SAFARIGB 🌍

A modern, premium tourism marketplace — a Booking.com-style platform for discovering and booking **Hotels, Homestays, Tour Companies, Transport, Tour Guides, Photographers, Restaurants and Activities**, all in one seamless experience.

Built with **Next.js 15 (App Router)**, **TypeScript**, **Tailwind CSS**, **ShadCN-style UI** and **Framer Motion**.

## ✨ Features

- Premium, fully responsive, mobile-first homepage
- Brand theme: **Forest Green `#0F4C3A`**, **Gold `#E5B94B`**, **White**
- Animated hero with a tabbed, Booking.com-style search bar
- Eight category cards, interactive filtered listings grid, masonry destinations, "why us", testimonials and a partner CTA
- Sticky glass navbar with animated mobile menu, rich footer with newsletter
- Scroll-reveal and hover micro-interactions throughout (Framer Motion)
- Typed mock data — swap `src/lib/data.ts` for a real API later

## 🚀 Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build   # production build
npm run start   # serve the build
```

## 🗂 Project structure

```
src/
├─ app/
│  ├─ layout.tsx         # fonts, metadata, root layout
│  ├─ page.tsx           # homepage composition
│  └─ globals.css        # theme tokens + Tailwind layers
├─ components/
│  ├─ ui/                # ShadCN-style primitives (button, card, input, badge, reveal)
│  ├─ layout/            # navbar, footer
│  └─ home/              # hero, categories, featured, destinations, why-us, testimonials, partner CTA
└─ lib/
   ├─ data.ts            # typed categories, listings, destinations, testimonials
   └─ utils.ts           # cn(), formatPrice()
```

## 🎨 Theme

Colors are exposed as CSS variables in `globals.css` and as Tailwind tokens (`forest`, `gold`, plus the semantic `primary`/`secondary`/`muted` scales) in `tailwind.config.ts`. Dark mode tokens are included.

## 🔁 Replacing mock data

All content comes from `src/lib/data.ts`. Replace the exported arrays with data from your API or database (the shapes are fully typed) and the UI updates automatically.

---

Images via [Unsplash](https://unsplash.com). Icons by [Lucide](https://lucide.dev).

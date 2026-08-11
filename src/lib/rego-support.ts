/* ============================================================
 * REGO SUPPORT KNOWLEDGE
 *
 * Customer-help answers for "how do I…" questions about using Rego itself
 * (booking, cancelling, payments, becoming a partner, jobs, accounts).
 * These are answered deterministically — no AI tokens — and always point at
 * the real page that does the job.
 *
 * Everything here mirrors pages that actually exist in the app. If a policy
 * changes, update the linked legal page; keep these summaries short.
 * ============================================================ */

import { siteConfig } from "@/lib/site";

export interface SupportAnswer {
  /** Short spoken answer. */
  reply: string;
  /** Where to go to actually do it. */
  action?: { label: string; href: string; description: string };
}

interface SupportTopic {
  id: string;
  /** Any of these phrases identifies the topic. */
  keys: string[];
  answer: SupportAnswer;
}

const CONTACT_HREF = "/contact";
const HELPLINE = siteConfig.contactPhoneDisplay;

const TOPICS: SupportTopic[] = [
  {
    id: "register",
    keys: [
      // English
      "how do i register", "how to register", "how can i register", "register",
      "sign up", "signup", "create an account", "make an account", "new account",
      "how do i join", "how to join", "join rego",
      // Roman Urdu — how people actually type it
      "register kry", "register kare", "register karna", "register karen",
      "ksy register", "kaise register", "kese register", "kaisay register",
      "account kaise", "account kese", "account banana", "account banaye",
      "account banao", "sign up kaise", "kaise join", "kese join",
      "rejister",
    ],
    answer: {
      reply:
        "Tap Sign in / Create account, enter your name, email and a password, then verify your email — " +
        "that's it, you can book straight away. If you run a tourism business, choose the partner option " +
        "instead so you can list your hotel, transport, guiding or restaurant service.",
      action: {
        label: "Create your account",
        href: "/signup",
        description: "Free to join — takes under a minute.",
      },
    },
  },
  {
    id: "how-to-book",
    keys: [
      "how do i book", "how to book", "how can i book", "booking process",
      "booking kaise", "booking kese", "book kaise", "kaise book", "ksy book",
      "booking karna", "booking karni",
      "how booking works", "book kaise", "booking kaise", "how do i reserve",
      "how to reserve", "make a booking",
    ],
    answer: {
      reply:
        "Open the listing you like, pick your dates and guests, then send a booking request. " +
        "The provider confirms it and you'll get an email with your booking reference. " +
        "You can track it any time from Booking Status or your dashboard.",
      action: {
        label: "How It Works",
        href: "/how-it-works",
        description: "Step-by-step guide to booking on Rego.",
      },
    },
  },
  {
    id: "booking-status",
    keys: [
      "where is my booking", "track my booking", "booking status", "check my booking",
      "meri booking", "booking kahan", "booking confirm hui",
      "my reservation", "did my booking", "booking confirm", "is my booking confirmed",
      "booking reference",
    ],
    answer: {
      reply:
        "Use Booking Status and enter your booking reference (it's in your confirmation email) " +
        "to see whether the provider has accepted it. If you're signed in, every booking is also " +
        "listed under My Bookings in your dashboard.",
      action: {
        label: "My Dashboard",
        href: "/dashboard",
        description: "See all your bookings and messages in one place.",
      },
    },
  },
  {
    id: "cancel-refund",
    keys: [
      "cancel my booking", "how to cancel", "how do i cancel", "cancellation",
      "cancel kaise", "cancel karna", "paise wapas", "paisay wapas", "refund kaise",
      "cancel karna", "refund", "money back", "get my money", "refund policy",
      "cancellation policy", "cancel booking",
    ],
    answer: {
      reply:
        "Cancellation and refund terms are set by each provider and shown on the listing before you book. " +
        "To cancel, message the provider from your dashboard or contact our team with your booking reference — " +
        "the full terms are in our Cancellation and Refund policies.",
      action: {
        label: "Cancellation & Refund Policy",
        href: "/legal/cancellation",
        description: "The exact terms that apply to your booking.",
      },
    },
  },
  {
    id: "payment",
    keys: [
      "how do i pay", "how to pay", "payment method", "payment options", "is payment safe",
      "payment kaise", "paise kaise", "adaigi", "payment karna",
      "payment secure", "advance payment", "pay online", "cash payment", "payment kaise",
    ],
    answer: {
      reply:
        "Payment details are shown by each provider after your booking is confirmed — many accept bank " +
        "transfer, mobile wallets or cash on arrival. Rego never asks for your card PIN or full bank " +
        "credentials, and you should only ever pay through the details shown on your confirmed booking.",
      action: {
        label: "Booking Policy",
        href: "/legal/booking",
        description: "How payments and confirmations work on Rego.",
      },
    },
  },
  {
    id: "become-partner",
    keys: [
      "become a partner", "list my business", "list my hotel", "add my hotel",
      "partner kaise", "partner kese", "apna hotel list", "business register",
      "apna business", "hotel add karna",
      "register my business", "how do i list", "how to list", "join as provider",
      "add my property", "sell on rego", "partner banna", "apna hotel",
    ],
    answer: {
      reply:
        "Create a partner account, choose your service type (hotel, homestay, transport, guide, restaurant " +
        "and more), then add your listing with photos, prices and details. Our team reviews it, and once " +
        "approved it goes live and travellers can book you.",
      action: {
        label: "Become a Partner",
        href: "/partner",
        description: "Register your tourism business on Rego — it's free to list.",
      },
    },
  },
  {
    id: "verification",
    keys: [
      "get verified", "verification", "verified badge", "how to verify", "blue tick",
      "golden tick", "trusted badge",
    ],
    answer: {
      reply:
        "Verified providers have had their business details and documents checked by our team. " +
        "Submit your verification documents from your provider dashboard — once approved you get the gold " +
        "verified badge on your listings, which noticeably improves traveller trust.",
      action: {
        label: "My Dashboard",
        href: "/dashboard",
        description: "Upload verification documents from your provider dashboard.",
      },
    },
  },
  {
    id: "post-job",
    keys: [
      "post a job", "how do i post a job", "hire staff", "advertise a job", "job posting",
      "post vacancy", "hiring", "recruit",
    ],
    answer: {
      reply:
        "If you're a registered provider, open Post a Job in your dashboard. Your business details fill in " +
        "automatically — add the role, salary and deadline, then submit. Our team reviews it and it appears " +
        "on the public Rego Jobs page, where applications come straight back to your dashboard.",
      action: {
        label: "Rego Jobs",
        href: "/jobs",
        description: "Browse tourism jobs across Gilgit-Baltistan.",
      },
    },
  },
  {
    id: "find-job",
    keys: [
      "find a job", "looking for job", "job in", "jobs available", "apply for job",
      "naukri kaise", "job kaise", "job chahiye",
      "vacancy", "vacancies", "naukri", "employment", "career", "careers", "work with rego",
    ],
    answer: {
      reply:
        "Browse open roles on the Rego Jobs page — hotels, restaurants, tour companies, transport, guides " +
        "and more across Gilgit-Baltistan. Filter by category, location or employment type, then apply " +
        "directly with your details and CV.",
      action: {
        label: "Rego Jobs",
        href: "/jobs",
        description: "Tourism jobs from verified businesses across GB.",
      },
    },
  },
  {
    id: "account",
    keys: [
      "forgot password", "reset password", "change password", "cant login", "can't login",
      "cannot login", "login problem", "sign in problem", "change my email", "delete my account",
      "account problem",
    ],
    answer: {
      reply:
        "Use the \"Forgot password\" link on the sign-in page to reset it by email. To change your email or " +
        "phone, open Profile in your dashboard. If you're locked out or want your account removed, contact " +
        "our team and we'll sort it.",
      action: {
        label: "Sign in",
        href: "/signin",
        description: "Reset your password or sign back in.",
      },
    },
  },
  {
    id: "contact",
    keys: [
      "contact you", "contact rego", "talk to someone", "customer service", "customer support",
      "rabta", "baat karni", "baat karna", "madad", "help chahiye",
      "helpline", "phone number", "call you", "complaint", "report a problem", "human",
      "speak to", "email you",
    ],
    answer: {
      reply:
        `You can reach the Rego team on our helpline ${HELPLINE}, or send us a message from the Contact page — ` +
        "we reply to every query. For a problem with a specific booking, include your booking reference so we " +
        "can look it up straight away.",
      action: {
        label: "Contact Us",
        href: CONTACT_HREF,
        description: "Helpline, email and message form.",
      },
    },
  },
  {
    id: "safety",
    keys: [
      "is it safe", "safe to travel", "is rego safe", "scam", "fraud", "trust rego",
      "reliable", "genuine",
    ],
    answer: {
      reply:
        "Every provider on Rego is a registered business, and verified ones have had their documents checked " +
        "by our team. Ratings and reviews come only from real travellers who actually booked. Always keep your " +
        "booking and payment inside Rego so we can help if something goes wrong.",
      action: {
        label: "Safety & Trust",
        href: "/legal/safety",
        description: "How Rego keeps bookings safe.",
      },
    },
  },
  {
    id: "review",
    keys: [
      "leave a review", "write a review", "post a review", "rate a hotel", "review policy",
      "remove a review", "fake review",
    ],
    answer: {
      reply:
        "You can review a provider once you've completed a confirmed booking with them — that's why every " +
        "rating on Rego comes from a real stay or trip. Open the listing from your dashboard and leave your " +
        "rating and comments there.",
      action: {
        label: "Review Policy",
        href: "/legal/reviews",
        description: "How reviews work and what's allowed.",
      },
    },
  },
  {
    id: "roadside-help",
    keys: [
      "my car broke", "car broke down", "breakdown", "flat tyre", "puncture", "out of fuel",
      "need a tow", "stuck on the road", "emergency help",
    ],
    answer: {
      reply:
        "Open Roadside Assistance and pick the service you need — puncture, battery, fuel delivery or vehicle " +
        "recovery — to see verified providers near you and send an emergency request in seconds.",
      action: {
        label: "Roadside Assistance",
        href: "/roadside",
        description: "Emergency help on GB roads, 24/7 providers.",
      },
    },
  },
];

/** Word-boundary-safe phrase match (Urdu script falls back to substring). */
function hits(q: string, phrase: string): boolean {
  if (/[؀-ۿ]/.test(phrase)) return q.includes(phrase);
  const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z])${esc}([^a-z]|$)`, "i").test(q);
}

/**
 * Match a customer-support question. Returns null when it isn't one, so the
 * normal travel/listing routing takes over.
 */
export function answerSupport(raw: string): SupportAnswer | null {
  const q = raw.toLowerCase().trim();
  let best: SupportTopic | null = null;
  let bestLen = 0;
  for (const t of TOPICS) {
    for (const k of t.keys) {
      if (hits(q, k) && k.length > bestLen) {
        best = t;
        bestLen = k.length;
      }
    }
  }
  return best ? best.answer : null;
}

/** True when the question looks like customer support rather than travel. */
export function isSupportQuery(raw: string): boolean {
  return answerSupport(raw) !== null;
}

/** Compact support summary given to the LLM so it can answer variations. */
export const SUPPORT_KNOWLEDGE = [
  "REGO HELP (use these facts for questions about using Rego):",
  "- Booking: open a listing, pick dates/guests, send a request; the provider confirms and you get a reference by email.",
  "- Track a booking: Booking Status with your reference, or My Bookings in the dashboard.",
  "- Cancellations/refunds: set per provider and shown on the listing; details at /legal/cancellation and /legal/refund.",
  "- Payments: arranged with the provider after confirmation (bank transfer, wallet or cash). Rego never asks for card PINs.",
  "- Become a provider: /partner — register, add a listing, our team approves it, then it goes live.",
  "- Verification: upload documents in the provider dashboard to earn the gold verified badge.",
  "- Jobs: providers post vacancies from their dashboard (admin-approved); travellers browse and apply at /jobs.",
  "- Account: reset password from /signin; change email/phone in dashboard Profile.",
  `- Contact: helpline ${HELPLINE} or /contact.`,
  "- Roadside emergencies: /roadside (puncture, battery, fuel, recovery).",
].join("\n");

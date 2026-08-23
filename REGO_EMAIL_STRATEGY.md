# Rego — Email Setup

Two separate systems. Keeping them separate is the single most important decision here.

---

## 1. Operational email (live now)

Sent because a specific event happened. No consent needed, no unsubscribe — nobody unsubscribes from their own booking confirmation.

### Alerts to you (admin)

| Trigger | Subject | Links to |
|---|---|---|
| Provider signs up | `New provider: Hunza Grand (hotels)` | Users tab |
| Service requested | `Service request: transport — Ali Tours` | Service Requests tab |
| Listing submitted | `New listing to review: Shangrila Resort (hotels)` | Verification tab |
| Job application | `Application: Marketing Manager — Zuneera` | Applications tab |

**Why the subject line carries everything:** you read these on a phone. You should be able to decide whether to act now from the notification bar, without opening anything.

**One action per email,** linking to the exact admin tab — not "log in and look around".

### Emails to users

Welcome, listing approved/rejected, booking confirmation, application status. Already built.

---

## 2. Marketing email (not built — read before starting)

Campaigns and newsletters to travellers. Fundamentally different, and **must never share code with the above.**

### Why the separation matters more than it sounds

Your domain currently passes SPF, DKIM and DMARC — that took work and it's worth protecting. The way people lose it: send promotional mail to a list that didn't ask for it, collect spam complaints, and the domain's reputation drops. Then **booking confirmations start landing in spam too**, and the marketplace quietly breaks. Transactional mail is infrastructure; marketing mail is the thing that can poison it.

The standard fix is a subdomain — send marketing from `news.rego.services` so its reputation is separate from `rego.services`. Worth doing before the first campaign, not after.

### What's needed first

**Consent, stored per user.** A `marketing_opt_in` boolean on profiles, set by a checkbox that is **not pre-ticked**. Signing up for a booking is not consent to receive newsletters.

**A working unsubscribe link in every message.** One click, no login, takes effect immediately. This is a legal requirement in most markets and Gmail now demands it for bulk senders.

**A send schedule that respects Hostinger's limit.** You have roughly 3,000/day. A 2,000-person campaign fired at once will hit the cap and silently drop the rest — exactly the failure we spent a day chasing. Send in batches with a delay.

### What actually works for a GB marketplace

**Seasonal, not weekly.** "Deosai opens next month" in May. "Blossom season starts in Hunza" in March. "Roads are closing, plan for spring" in October. Four to six a year, each genuinely useful. A weekly newsletter about a region people visit once a year trains people to ignore you.

**Segment by behaviour, not by blast.** Someone who searched Skardu hotels and didn't book is worth a different email from someone who completed a trip. The first needs a reason to come back; the second needs a review request and a reason to return next season.

**The highest-value email you're not sending: the abandoned booking.** Someone who filled a booking form and stopped is your warmest lead. One message, 24 hours later, no discount — just "your Skardu booking is still saved". This typically outperforms every campaign combined.

**Providers are a separate audience.** They care about bookings, payouts and how to improve their listing. Never send them traveller marketing.

### What to avoid

- Buying or scraping email lists. It is the fastest route to a blacklisted domain.
- "Last chance!" urgency on a trip people plan months ahead. It reads as desperate and it isn't true.
- Sending to addresses that bounced. Repeated bounces damage sender reputation — remove them after two failures.
- Discount codes as a default. In a marketplace they train providers to expect you to discount their inventory.

---

## Current state

**Working:** SPF, DKIM and DMARC all pass — confirmed by a Google DMARC report. Hostinger SMTP with `info@rego.services`. Admin alerts and user transactional email.

**Known limits:** ~3,000 sends/day on Hostinger. One mailbox. No marketing consent field yet, no unsubscribe mechanism, no marketing subdomain.

**Before the first campaign:** add the opt-in field, build unsubscribe, set up `news.rego.services`, and batch the sending. In that order.

# SAFARIGB — Email Confirmations Setup (Resend)

Sends booking + approval emails. ~5 minutes.

## 1. Create a free Resend account
1. Go to https://resend.com and sign up (free: 100 emails/day).
2. Verify your email.

## 2. Get an API key
1. In Resend → **API Keys** → **Create API Key**.
2. Name it (e.g. `safarigb`), permission **Sending access**, **Create**.
3. Copy the key — it starts with `re_...` (you only see it once).

## 3. Add it to .env.local
Add this line (keep your other keys). It is a **server secret** — note there is
NO `NEXT_PUBLIC_` prefix, so it never reaches the browser:
```
RESEND_API_KEY=re_your_real_key
```
Save.

## 4. Restart
```
npm run dev
```

## 5. Test
Make a booking → you (and the owner) should get an email. Accept/reject it →
the customer gets a status email.

---

### Important: test mode vs real sending
- Out of the box, emails are sent **from** `onboarding@resend.dev`. In test mode,
  Resend will only **deliver to the email address you signed up with** — great for
  testing with your own account.
- To email **any** customer, verify your own domain in Resend
  (**Domains → Add Domain**, add the DNS records), then set in `.env.local`:
  ```
  EMAIL_FROM=SAFARIGB <bookings@yourdomain.com>
  ```
- If you skip this entirely, the app still works — it just won't send emails
  (everything else is unaffected).

# Security

Rego is a live website, not a released library. There are no version
numbers to support — whatever is deployed at **www.rego.services** is the
only version that exists, and a fix reaches everyone the moment it ships.

## Reporting something

**Email [info@rego.services](mailto:info@rego.services)** with `SECURITY` in
the subject line. If you have a GitHub account you can instead use
[private vulnerability reporting](https://github.com/northdigitaltech-boop/rego/security/advisories/new),
which keeps the report invisible until it is fixed.

**Please do not open a public issue or a pull request for a security
problem.** This repository is public, so an issue describing a hole is a
description of how to exploit it, readable by anyone, for as long as the
fix takes.

Useful in a report, roughly in order of usefulness:

- What you did, in enough detail to repeat it
- What happened that should not have
- The URL, and roughly when
- A screenshot, if it shows something a description cannot

You do not need to write it in English. Urdu is fine.

## What Rego will do

This is a small team, so here is the honest version rather than a
service-level agreement nobody can keep:

- Your report will be read, and you will get a reply
- If it is real, it gets fixed before anything else on the list
- You will be told when it is fixed
- If you would like credit once it is fixed, say so and you will get it

There is no bug bounty. Nothing is paid for a report.

## In scope

- **www.rego.services** and everything under it
- This repository — including anything committed here that should not have
  been, such as a key or a credential
- The booking, sign-in and provider dashboard flows

## Not in scope

- **Anything that harms real people or real data.** Rego carries genuine
  travellers' bookings and genuine businesses' listings. Do not test with
  someone else's account, do not read other people's bookings, and do not
  create bookings against a real provider who will act on them.
- **Denial of service, load testing, or anything that takes the site down.**
  A guesthouse in Skardu misses a booking, and nothing is learnt that could
  not be learnt without it.
- Reports produced only by an automated scanner, with no working example
- Missing security headers, or a weak TLS setting, with no path to an actual
  impact
- Social engineering of Rego staff or of any listed provider

If you need a test account to demonstrate something, ask — that is a
reasonable request and it will be arranged.

## What is already in place

Written down so a report can say something new rather than something known:

- Row-level security on every table; providers can read and write only their
  own listings and bookings, and travellers only their own bookings
- Server-side authorisation on every route that changes or reveals data —
  the browser holds the public anon key, so no check in a component is
  treated as a check
- Email verification is required before an account is usable
- The Supabase service-role key exists only on the server and is never sent
  to a browser

## Reporting something that is not a vulnerability

For a wrong price, a listing that should not be there, a provider behaving
badly, or a booking that went wrong, use
[www.rego.services/contact](https://www.rego.services/contact) or email
[info@rego.services](mailto:info@rego.services). Those matter too — they are
just not this file.

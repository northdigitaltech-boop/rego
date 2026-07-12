# SAFARIGB — Destination Search Setup (Google Maps Places)

Adds place autocomplete to the "Where are you going?" search box.

> Note: Google requires a Cloud account with **billing enabled** (a card on file)
> even though Maps has a large free monthly credit. If you'd rather not add a card,
> tell me and I'll switch to the free OpenStreetMap autocomplete instead.

## 1. Create a Google Cloud project
1. Go to https://console.cloud.google.com and sign in.
2. Top bar → project dropdown → **New Project** → name it `safarigb` → Create.

## 2. Enable the APIs
1. Menu → **APIs & Services → Library**.
2. Enable **Maps JavaScript API**.
3. Enable **Places API**.

## 3. Enable billing
- Menu → **Billing** → link a billing account (add a card). Maps gives a monthly
  free credit that easily covers development.

## 4. Create an API key
1. Menu → **APIs & Services → Credentials → Create credentials → API key**.
2. Copy the key.
3. (Recommended) Click the key → under **Application restrictions** choose
   **Websites**, and add `http://localhost:3000/*`. Under **API restrictions**,
   restrict to Maps JavaScript API + Places API.

## 5. Add it to .env.local
Replace the placeholder line with your real key:
```
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...your-key...
```

## 6. Restart
```
npm run dev
```

## 7. Try it
On the homepage search, type in **"Where are you going?"** — Google place
suggestions (restricted to Pakistan) appear. Pick one and hit **Search** — you'll
land on the listings page filtered to that location.

---

### Notes
- This key is used in the browser (that's normal for Maps JS) — restrict it by
  website referrer so others can't reuse it.
- If you don't set the key, the search box still works as a plain text field, and
  Search still filters by whatever you type.

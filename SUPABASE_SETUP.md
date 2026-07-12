# SAFARIGB — Backend Setup (Phase 1: Hotels)

Follow these 5 steps once. After this, hotel data lives in a real database.

## 1. Create a free Supabase project
1. Go to https://supabase.com and sign up (free).
2. Click **New project**. Give it a name (e.g. `safarigb`), set a database password (save it somewhere), pick a region near Pakistan (e.g. Singapore), and create it.
3. Wait ~2 minutes for it to finish setting up.

## 2. Get your keys
1. In the project, go to **Project Settings → API**.
2. Copy two values:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long string under "Project API keys")
3. ⚠️ Do **not** copy the `service_role` secret key. We don't use it here.

## 3. Add the keys to the project
1. In the project folder, make a copy of `.env.local.example` and name it **`.env.local`**.
2. Paste your two values in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://abcd1234.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...your-long-anon-key...
   ```
3. Save the file.

## 4. Install the Supabase package
In the project terminal:
```
npm install @supabase/supabase-js
```

## 5. Create the database tables
1. In Supabase, open **SQL Editor → New query**.
2. Open the file `supabase/schema.sql` from this project, copy ALL of it, paste it into the SQL editor.
3. Click **Run**. You should see "Success".
4. Check **Table Editor** — you'll see `hotels` (with 5 rows) and `rooms`.

## 6. Restart
```
npm run dev
```

✅ When all 6 steps are done, tell me **"Supabase is set up"** and I'll connect the hotel pages to read from the database.

---

### Notes
- The `anon` key is safe to use in the browser (that's its purpose). The `service_role` key is secret — never share or commit it.
- `.env.local` is already git-ignored, so your keys won't be committed.

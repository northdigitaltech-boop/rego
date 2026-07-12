# SAFARIGB — Photo Uploads Setup (Cloudinary)

This lets hotel owners upload real photos. ~5 minutes.

## 1. Create a free Cloudinary account
1. Go to https://cloudinary.com and sign up (free).
2. After signup you land on the **Dashboard**. Note your **Cloud name** (e.g. `dxyz123`) — it's near the top.

## 2. Create an unsigned upload preset
1. Go to **Settings** (gear icon) → **Upload** tab.
2. Scroll to **Upload presets** → click **Add upload preset**.
3. Set **Signing Mode** to **Unsigned**.
4. (Optional) Set a folder like `safarigb`.
5. **Save**. Copy the **preset name** it shows (e.g. `safarigb_unsigned`).

## 3. Add the keys to .env.local
Open `.env.local` (in the project) and add these two lines (keep your Supabase lines):
```
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud-name
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=your-unsigned-preset
```
Use your real cloud name and preset name. Save.

## 4. Restart
```
npm run dev
```

## 5. Try it
Hotel owner dashboard → **Add Hotel** (or Edit) → the **Hotel photo** box now lets you
**click to upload** a real image from your computer. It uploads to Cloudinary and the
photo is saved with the hotel.

---

### Notes
- These keys are safe to be public (that's what the unsigned preset is for).
- If you don't set these up, the form still works — you can paste an image URL instead.
- Real per-user upload limits/security can be added later with a signed upload flow.

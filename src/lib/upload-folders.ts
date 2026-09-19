/* ============================================================
 * Where each module's images live in Cloudinary.
 *
 * WHY THIS EXISTS
 *   Everything landed in one folder. At 438 assets that is
 *   already hard to work with; at ten thousand it is unusable —
 *   you cannot tell a hotel photo from a CV from a map pin, you
 *   cannot find what a deleted provider left behind, and you
 *   cannot answer "what is actually using our storage quota".
 *
 *   Folders are decided by the SERVER, from this list. The
 *   browser sends a module key and nothing else: a client that
 *   could name its own folder could write anywhere in the
 *   account, including over another module's files.
 *
 * KEYS MATCH REGO'S MODULES, NOT THE COMPONENT NAMES
 *   `hotels`, not `hotel-provider-dashboard`. A module keeps its
 *   folder when its UI is rewritten, which is the point of
 *   filing things by what they are.
 *
 * ADDING ONE
 *   Add the key here, then pass `folder="<key>"` at the upload
 *   site. An unknown key falls back to `misc` rather than
 *   failing the upload — a photo that lands in the wrong folder
 *   is a tidying problem; an upload that throws is a provider
 *   who cannot finish registering.
 * ============================================================ */

export const UPLOAD_FOLDERS = {
  /* Listings, by service module */
  hotels: "rego/hotels",
  homestays: "rego/homestays",
  hostels: "rego/hostels",
  restaurants: "rego/restaurants",
  transport: "rego/transport",
  guides: "rego/guides",
  "tour-companies": "rego/tour-companies",
  tours: "rego/tours",
  media: "rego/media",
  activities: "rego/activities",
  coworking: "rego/coworking",
  expeditions: "rego/expeditions",
  roadside: "rego/roadside",

  /* Content and editorial */
  blog: "rego/blog",
  events: "rego/events",
  ads: "rego/ads",
  destinations: "rego/destinations",
  attractions: "rego/attractions",
  map: "rego/map",
  safarnama: "rego/safarnama",

  /* People */
  avatars: "rego/avatars",
  staff: "rego/staff",

  /* Documents — CVs, licences, ownership papers */
  documents: "rego/documents",

  /* Site furniture an admin sets */
  site: "rego/site",

  /* Anything that has not been given a home yet */
  misc: "rego/misc",
} as const;

export type UploadFolder = keyof typeof UPLOAD_FOLDERS;

/** Resolve a module key to its path. Unknown keys become `misc`, never an error. */
export function folderFor(kind: string | undefined | null): string {
  if (!kind) return UPLOAD_FOLDERS.misc;
  return UPLOAD_FOLDERS[kind as UploadFolder] ?? UPLOAD_FOLDERS.misc;
}

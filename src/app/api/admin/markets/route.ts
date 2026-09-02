import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

import { clientIp } from "@/lib/rate-limit";
import { limitAndLog } from "@/lib/rate-limit-guard";
import { enforceIpBlock } from "@/lib/ip-block";

/* ============================================================
 * Market & Area Management — the only write path.
 *
 * These settings decide whether an area may take bookings and
 * whether its pages may be indexed. That makes this endpoint
 * worth attacking, so every request is:
 *
 *   • checked against the IP block list
 *   • same-origin
 *   • rate limited
 *   • authenticated, then verified admin by reading profiles
 *     server-side — never by trusting a claim in the request
 *   • validated field by field against a whitelist
 *   • written to market_audit_logs with before AND after values
 *
 * The frontend hides controls from non-admins. That is a
 * convenience, not a control: this route assumes the caller
 * built the request by hand.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (server-only, never
 * NEXT_PUBLIC — this repo is public).
 * ============================================================ */

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Columns a caller may set on locations. Anything else is rejected. */
const LOCATION_FLAGS = new Set([
  "is_active",
  "is_public",
  "onboarding_enabled",
  "listings_enabled",
  "booking_enabled",
  "manual_approval_required",
  "coming_soon",
  "is_featured",
  "seo_enabled",
]);

/** The subset that also exists per service. */
const SERVICE_FLAGS = new Set([
  "listings_enabled",
  "booking_enabled",
  "onboarding_enabled",
  "manual_approval_required",
  "coming_soon",
  "seo_enabled",
]);

/** Free-text fields that may be edited. Slug is NOT here — see below. */
const EDITABLE_FIELDS = new Set([
  "name",
  "display_order",
  "latitude",
  "longitude",
  "coming_soon_message",
]);

/* Slug is deliberately absent from EDITABLE_FIELDS.
   A location slug becomes part of a public URL. Changing one without
   writing a 301 into seo_redirects would drop a page out of the index
   silently. Slug editing belongs with the redirects tab, where the
   redirect can be created in the same transaction. */

/** SEO fields a caller may write. Anything outside this list is rejected. */
const SEO_FIELDS = new Set([
  "seo_title",
  "meta_description",
  "h1",
  "intro",
  "body",
  "focus_keyword",
  "canonical_url",
  "og_title",
  "og_description",
  "og_image",
  "hero_image",
  "hero_image_alt",
  "faq",
  "robots_index",
  "robots_follow",
]);

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://rego.services";

/* Location levels. Free text in the database on purpose — a country with an
   administrative level we did not anticipate must not require a migration —
   but the API still refuses anything outside this list, so a typo cannot
   quietly create a level that nothing renders. */
/* Must stay in step with LOCATION_TYPES in src/lib/markets.ts. They were out
   of step: attraction and landmark were added to the picker there and not
   here, so the admin could choose "Attraction" and the API would refuse it. */
const LOCATION_TYPES = new Set([
  "country",
  "region",
  "division",
  "district",
  "city",
  "area",
  "attraction",
  "landmark",
]);

const MAX_BULK = 200;

function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

function sameOrigin(req: Request): boolean {
  const host = req.headers.get("host");
  const origin = req.headers.get("origin") || req.headers.get("referer");
  if (!host || !origin) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Hashed, never stored raw — an audit trail should not become a log of IPs. */
function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: Request) {
  const blocked = await enforceIpBlock(req);
  if (blocked) return blocked;

  if (!sameOrigin(req)) return bad("Forbidden", 403);

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return bad("Market management is not configured on this server.", 500);
  }

  /* NOTE ON THIS LIMIT: rateLimit() is in-memory and therefore PER VERCEL
     INSTANCE. It slows a single runaway client; it is not a hard cap across
     the fleet. A shared store is needed before this can be called real
     rate limiting. Recorded here so nobody reads this line as a guarantee. */
  const ip = clientIp(req);
  const limited = limitAndLog(req, `market-admin:${ip}`, 40, 60_000, {
    endpoint: "/api/admin/markets",
    category: "admin",
  });
  if (!limited.ok) return bad("Too many changes in a short time. Wait a minute.", 429);

  /* ---- authenticate ---- */
  const authz = req.headers.get("authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "";
  if (!token) return bad("Sign in required.", 401);

  const sb = adminClient();
  const { data: caller, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !caller?.user) return bad("Session expired. Sign in again.", 401);

  /* ---- authorise: read the role from the database, not the request ---- */
  const { data: profile } = await sb
    .from("profiles")
    .select("role, email")
    .eq("id", caller.user.id)
    .maybeSingle();

  const role = (profile as { role?: string } | null)?.role;
  if (role !== "admin") return bad("Admins only.", 403);

  const actorEmail =
    (profile as { email?: string } | null)?.email ?? caller.user.email ?? null;

  /* ---- parse ---- */
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return bad("Malformed request.");
  }

  const action = String(body.action ?? "");
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  /** Append-only audit write. Never blocks the change it records. */
  const audit = async (entry: {
    action: string;
    entityType: string;
    entityId?: string | null;
    entityLabel?: string | null;
    before?: unknown;
    after?: unknown;
  }) => {
    try {
      await sb.from("market_audit_logs").insert({
        actor_id: caller.user.id,
        actor_email: actorEmail,
        action: entry.action,
        entity_type: entry.entityType,
        entity_id: entry.entityId ?? null,
        entity_label: entry.entityLabel ?? null,
        before_value: entry.before ?? null,
        after_value: entry.after ?? null,
        request_id: requestId,
        ip_hash: ip ? hashIp(ip) : null,
      });
    } catch {
      /* An audit failure must not roll back a change the admin already
         saw succeed. It is logged as a gap, not surfaced as an error. */
    }
  };

  switch (action) {
    /* ---------------------------------------------------------------- */
    case "set_location_flag": {
      const locationId = String(body.locationId ?? "");
      const flag = String(body.flag ?? "");
      const value = body.value;

      if (!locationId) return bad("Missing location.");
      if (!LOCATION_FLAGS.has(flag)) return bad("Unknown setting.");
      if (value !== null && typeof value !== "boolean") {
        return bad("Value must be true, false, or null to inherit.");
      }

      /* select("*") rather than a string-concatenated column list: a dynamic
         select defeats the generated types, and the row is one record. */
      const { data: beforeRow } = await sb
        .from("locations")
        .select("*")
        .eq("id", locationId)
        .maybeSingle();

      if (!beforeRow) return bad("Location not found.", 404);
      const before = beforeRow as Record<string, unknown>;

      const { error } = await sb
        .from("locations")
        .update({ [flag]: value, updated_by: caller.user.id, updated_at: new Date().toISOString() })
        .eq("id", locationId);

      if (error) return bad(error.message, 500);

      await audit({
        action: value === null ? "location.reset_to_inherited" : "location.set_flag",
        entityType: "location",
        entityId: locationId,
        entityLabel: (before.name as string | undefined) ?? null,
        before: { [flag]: before[flag] },
        after: { [flag]: value },
      });

      return NextResponse.json({ ok: true });
    }

    /* ---------------------------------------------------------------- */
    case "set_service_flag": {
      const locationId = String(body.locationId ?? "");
      const serviceSlug = String(body.serviceSlug ?? "");
      const flag = String(body.flag ?? "");
      const value = body.value;

      if (!locationId || !serviceSlug) return bad("Missing location or service.");
      if (!SERVICE_FLAGS.has(flag)) return bad("Unknown setting for a service.");
      if (value !== null && typeof value !== "boolean") {
        return bad("Value must be true, false, or null to inherit.");
      }

      // Reject unknown services rather than silently creating a row for a
      // typo'd slug that would then be invisible in the UI.
      const { data: svc } = await sb
        .from("service_categories")
        .select("slug")
        .eq("slug", serviceSlug)
        .maybeSingle();
      if (!svc) return bad("Unknown service.");

      const { data: existing } = await sb
        .from("location_service_settings")
        .select("*")
        .eq("location_id", locationId)
        .eq("service_slug", serviceSlug)
        .maybeSingle();

      const beforeVal = existing
        ? (existing as Record<string, unknown>)[flag]
        : null;

      const { error } = await sb.from("location_service_settings").upsert(
        {
          location_id: locationId,
          service_slug: serviceSlug,
          [flag]: value,
          updated_by: caller.user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "location_id,service_slug" }
      );

      if (error) return bad(error.message, 500);

      await audit({
        action: value === null ? "service.reset_to_inherited" : "service.set_flag",
        entityType: "location_service",
        entityId: locationId,
        entityLabel: `${serviceSlug}`,
        before: { [flag]: beforeVal },
        after: { [flag]: value },
      });

      return NextResponse.json({ ok: true });
    }

    /* ---------------------------------------------------------------- */
    case "apply_to_children": {
      const locationId = String(body.locationId ?? "");
      const flag = String(body.flag ?? "");
      const value = body.value;

      if (!locationId) return bad("Missing location.");
      if (!LOCATION_FLAGS.has(flag)) return bad("Unknown setting.");
      if (value !== null && typeof value !== "boolean") return bad("Bad value.");

      const { data: root } = await sb
        .from("locations")
        .select("id, name")
        .eq("id", locationId)
        .maybeSingle();
      if (!root) return bad("Location not found.", 404);

      // `ancestors` is maintained by the phase72 trigger, so a containment
      // test finds the whole subtree in one query rather than recursing.
      const { data: kids } = await sb
        .from("locations")
        .select("id")
        .contains("ancestors", [locationId]);

      const ids = ((kids as { id: string }[]) ?? []).map((k) => k.id);

      if (ids.length > MAX_BULK) {
        return bad(
          `That would change ${ids.length} areas. Apply to a smaller branch instead.`,
        );
      }

      const { error } = await sb
        .from("locations")
        .update({ [flag]: value, updated_by: caller.user.id, updated_at: new Date().toISOString() })
        .in("id", [locationId, ...ids]);

      if (error) return bad(error.message, 500);

      await audit({
        action: "location.apply_to_children",
        entityType: "location",
        entityId: locationId,
        entityLabel: (root as { name?: string }).name ?? null,
        before: { note: "see individual rows" },
        after: { [flag]: value, affected: ids.length + 1 },
      });

      return NextResponse.json({ ok: true, affected: ids.length + 1 });
    }

    /* ---------------------------------------------------------------- */
    case "bulk_set_flag": {
      const raw = body.locationIds;
      const flag = String(body.flag ?? "");
      const value = body.value;

      if (!Array.isArray(raw) || raw.length === 0) return bad("Nothing selected.");
      if (raw.length > MAX_BULK) return bad(`Select at most ${MAX_BULK} areas.`);
      if (!LOCATION_FLAGS.has(flag)) return bad("Unknown setting.");
      if (value !== null && typeof value !== "boolean") return bad("Bad value.");

      const ids = raw.map(String);

      const { data: before } = await sb
        .from("locations")
        .select("id, name, " + flag)
        .in("id", ids);

      const { error } = await sb
        .from("locations")
        .update({ [flag]: value, updated_by: caller.user.id, updated_at: new Date().toISOString() })
        .in("id", ids);

      if (error) return bad(error.message, 500);

      await audit({
        action: "location.bulk_set_flag",
        entityType: "location",
        entityId: null,
        entityLabel: `${ids.length} areas`,
        before: { rows: before },
        after: { [flag]: value },
      });

      return NextResponse.json({ ok: true, affected: ids.length });
    }

    /* ---------------------------------------------------------------- */
    case "update_location": {
      const locationId = String(body.locationId ?? "");
      const patch = (body.patch ?? {}) as Record<string, unknown>;

      if (!locationId) return bad("Missing location.");

      const clean: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patch)) {
        if (!EDITABLE_FIELDS.has(k)) {
          return bad(`"${k}" cannot be edited here.`);
        }
        if (k === "display_order") {
          const n = Number(v);
          if (!Number.isInteger(n) || n < 0 || n > 9999) return bad("Bad display order.");
          clean[k] = n;
        } else if (k === "latitude" || k === "longitude") {
          if (v === null || v === "") { clean[k] = null; continue; }
          const n = Number(v);
          const limit = k === "latitude" ? 90 : 180;
          if (!Number.isFinite(n) || Math.abs(n) > limit) return bad(`Bad ${k}.`);
          clean[k] = n;
        } else {
          const s = String(v ?? "").trim();
          if (k === "name" && s.length === 0) return bad("Name cannot be empty.");
          if (s.length > 500) return bad(`"${k}" is too long.`);
          clean[k] = s || null;
        }
      }

      if (Object.keys(clean).length === 0) return bad("Nothing to change.");

      const { data: before } = await sb
        .from("locations")
        .select("*")
        .eq("id", locationId)
        .maybeSingle();
      if (!before) return bad("Location not found.", 404);

      const { error } = await sb
        .from("locations")
        .update({ ...clean, updated_by: caller.user.id, updated_at: new Date().toISOString() })
        .eq("id", locationId);

      if (error) return bad(error.message, 500);

      const beforeSubset: Record<string, unknown> = {};
      for (const k of Object.keys(clean)) {
        beforeSubset[k] = (before as Record<string, unknown>)[k];
      }

      await audit({
        action: "location.update",
        entityType: "location",
        entityId: locationId,
        entityLabel: (before as { name?: string }).name ?? null,
        before: beforeSubset,
        after: clean,
      });

      return NextResponse.json({ ok: true });
    }

    /* ---------------------------------------------------------------- */
    case "save_seo": {
      const locationId = String(body.locationId ?? "");
      const serviceSlug = body.serviceSlug ? String(body.serviceSlug) : null;
      const patch = (body.patch ?? {}) as Record<string, unknown>;

      if (!locationId) return bad("Missing location.");

      if (serviceSlug) {
        const { data: svc } = await sb
          .from("service_categories")
          .select("slug")
          .eq("slug", serviceSlug)
          .maybeSingle();
        if (!svc) return bad("Unknown service.");
      }

      const clean: Record<string, unknown> = {};
      let contentTouched = false;

      for (const [k, v] of Object.entries(patch)) {
        if (!SEO_FIELDS.has(k)) return bad(`"${k}" cannot be edited here.`);

        if (k === "robots_index" || k === "robots_follow") {
          if (typeof v !== "boolean") return bad(`${k} must be true or false.`);
          clean[k] = v;
          continue;
        }

        if (k === "faq") {
          if (!Array.isArray(v)) return bad("FAQ must be a list.");
          if (v.length > 20) return bad("At most 20 FAQ entries.");
          const items = v as { q?: unknown; a?: unknown }[];
          const cleaned = items
            .map((f) => ({
              q: String(f.q ?? "").trim().slice(0, 300),
              a: String(f.a ?? "").trim().slice(0, 2000),
            }))
            /* Drop half-filled entries. A question with no answer renders as
               an empty <dd> and, worse, ships as FAQPage markup with a blank
               acceptedAnswer — which is a structured-data violation. */
            .filter((f) => f.q && f.a);
          clean.faq = cleaned;
          contentTouched = true;
          continue;
        }

        const s = String(v ?? "").trim();
        if (s.length > 20000) return bad(`"${k}" is too long.`);

        if (k === "canonical_url" && s) {
          // Relative paths, or absolute URLs on our own origin. A canonical
          // pointing at another domain hands the page away.
          const ok =
            s.startsWith("/") ||
            (() => {
              try {
                return new URL(s).host === new URL(SITE_URL).host;
              } catch {
                return false;
              }
            })();
          if (!ok) return bad("Canonical must be a path on this site.");
        }

        if (["intro", "body"].includes(k)) contentTouched = true;
        clean[k] = s || null;
      }

      if (Object.keys(clean).length === 0) return bad("Nothing to change.");

      /* content_updated_at drives sitemap <lastmod>. Bump it only when the
         actual prose changed — not when a title or a robots flag was
         tweaked. A lastmod that moves for cosmetic edits teaches crawlers
         to stop trusting it. */
      if (contentTouched) clean.content_updated_at = new Date().toISOString();

      const { data: existing } = await sb
        .from("location_seo")
        .select("*")
        .eq("location_id", locationId)
        .eq("language_code", "en")
        .filter("service_slug", serviceSlug ? "eq" : "is", serviceSlug ?? null)
        .maybeSingle();

      const { error } = await sb.from("location_seo").upsert(
        {
          location_id: locationId,
          service_slug: serviceSlug,
          language_code: "en",
          ...clean,
          updated_by: caller.user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "location_id,service_slug,language_code" }
      );

      if (error) return bad(error.message, 500);

      const beforeSubset: Record<string, unknown> = {};
      if (existing) {
        for (const k of Object.keys(clean)) {
          beforeSubset[k] = (existing as Record<string, unknown>)[k];
        }
      }

      await audit({
        action: "seo.update",
        entityType: "location_seo",
        entityId: locationId,
        entityLabel: serviceSlug ? `${serviceSlug} page` : "destination page",
        before: existing ? beforeSubset : null,
        after: clean,
      });

      return NextResponse.json({ ok: true });
    }

    /* ---------------------------------------------------------------- */
    case "create_location": {
      const parentId = body.parentId ? String(body.parentId) : null;
      const marketId = String(body.marketId ?? "");
      const name = String(body.name ?? "").trim();
      const slug = String(body.slug ?? "").trim().toLowerCase();
      const type = String(body.locationType ?? "").trim();

      if (!marketId) return bad("Missing market.");
      if (!name) return bad("Name is required.");
      if (name.length > 120) return bad("Name is too long.");

      if (!LOCATION_TYPES.has(type)) {
        return bad(`Unknown location type "${type}".`);
      }

      /* Slug rules match the database CHECK constraint. Failing here gives a
         readable message instead of a raw Postgres constraint violation. */
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
        return bad("Slug must be lowercase letters, numbers and single hyphens.");
      }
      if (slug.length > 80) return bad("Slug is too long.");

      /* A new location starts with every flag NULL — inheriting from its
         parent. It is not public, not bookable and not indexable until
         somebody decides it should be. Creating a place is not the same as
         opening it for business. */
      let parent: Record<string, unknown> | null = null;
      if (parentId) {
        const { data } = await sb
          .from("locations")
          .select("*")
          .eq("id", parentId)
          .maybeSingle();
        if (!data) return bad("Parent location not found.", 404);
        parent = data as Record<string, unknown>;

        if (String(parent.market_id) !== marketId) {
          return bad("Parent belongs to a different market.");
        }

        /* phase81 blocks an area sharing its district's slug. Catching it
           here means a clear sentence rather than a database exception. */
        if (
          type === "area" &&
          parent.location_type === "district" &&
          parent.slug === slug
        ) {
          return bad(
            `"${name}" has the same slug as the district it sits in. If the destination IS the district, add content to the district itself instead of creating a child with the same name.`
          );
        }
      }

      const { data: created, error } = await sb
        .from("locations")
        .insert({
          market_id: marketId,
          parent_id: parentId,
          location_type: type,
          name,
          slug,
          country_code: (parent?.country_code as string) ?? "PK",
          latitude: numOrNull(body.latitude),
          longitude: numOrNull(body.longitude),
          display_order: Number.isInteger(Number(body.displayOrder))
            ? Number(body.displayOrder)
            : 100,
          created_by: caller.user.id,
          updated_by: caller.user.id,
        })
        .select("id, name, slug")
        .single();

      if (error) {
        if (error.code === "23505") {
          return bad(`A location with the slug "${slug}" already exists here.`);
        }
        return bad(error.message, 500);
      }

      await audit({
        action: "location.create",
        entityType: "location",
        entityId: created.id,
        entityLabel: created.name,
        before: null,
        after: { name, slug, location_type: type, parent_id: parentId },
      });

      return NextResponse.json({ ok: true, id: created.id });
    }

    /* ============================================================
     * Attractions saved on a destination, mirrored into the tree.
     *
     * WHY THIS EXISTS
     *   Attractions are edited in one place — the Destinations screen, on the
     *   destination they belong to. Asking an admin to type Shangrila Lake
     *   there and then type it again under Skardu in Market & Area Management
     *   is how the two lists come to disagree, and the disagreement is silent.
     *
     *   So the destination editor stays the only place attractions are
     *   written by hand, and this copies them into locations so the coverage
     *   picker can offer them.
     *
     * WHY REMOVED ONES ARE DEACTIVATED AND NOT DELETED
     *   A provider may already have ticked "we run tours to Shangrila Lake".
     *   service_locations references locations with ON DELETE RESTRICT, so a
     *   delete would fail anyway — and even if it succeeded, quietly removing
     *   a provider's stated coverage because an admin edited a blurb is not a
     *   trade anyone agreed to. Deactivating keeps the link and takes it out
     *   of the pickers.
     * ============================================================ */
    case "sync_attractions": {
      const destinationId = String(body.destinationId ?? "");
      if (!destinationId) return bad("Missing destination.");

      const { data: dest } = await sb
        .from("destinations")
        .select("id, name, slug, location_id, attractions")
        .eq("id", destinationId)
        .maybeSingle();

      if (!dest) return bad("Destination not found.", 404);

      const d = dest as {
        id: string;
        name: string;
        slug: string;
        location_id: string | null;
        attractions: unknown;
      };

      if (!d.location_id) {
        /* Not an error. phase75 attached most destinations to a location, but
           one added since then has none, and saying so is more use than
           failing. */
        return NextResponse.json({
          ok: true,
          skipped: true,
          message: `"${d.name}" is not linked to an area yet, so its attractions were not added to the location list. Link it in Market & Area Management first.`,
        });
      }

      const { data: parent } = await sb
        .from("locations")
        .select("id, market_id, country_code")
        .eq("id", d.location_id)
        .maybeSingle();

      if (!parent) return bad("The area this destination points at no longer exists.", 404);
      const p = parent as { id: string; market_id: string; country_code: string };

      const list = Array.isArray(d.attractions)
        ? (d.attractions as { name?: unknown }[])
        : [];

      /* Same rule as the database CHECK. A name that slugifies to nothing —
         punctuation only — is skipped rather than rejected, so one odd row
         does not stop the other seven being saved. */
      const wanted = new Map<string, string>();
      for (const a of list) {
        const name = String(a?.name ?? "").trim();
        if (!name || name.length > 120) continue;
        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        if (!slug || slug.length > 80) continue;
        if (!wanted.has(slug)) wanted.set(slug, name);
      }

      const { data: existingRows } = await sb
        .from("locations")
        .select("id, slug, name, is_active")
        .eq("parent_id", p.id)
        .eq("location_type", "attraction");

      const existing = (existingRows as
        | { id: string; slug: string; name: string; is_active: boolean | null }[]
        | null) ?? [];
      const bySlug = new Map(existing.map((e) => [e.slug, e]));

      let added = 0;
      let restored = 0;
      let deactivated = 0;

      for (const [slug, name] of wanted) {
        const found = bySlug.get(slug);
        if (found) {
          /* Reactivate if it had been removed and put back, and follow a
             rename. Never touch its flags — an admin may have made this
             attraction public deliberately. */
          if (found.is_active === false || found.name !== name) {
            await sb
              .from("locations")
              .update({
                name,
                is_active: found.is_active === false ? null : found.is_active,
                updated_by: caller.user.id,
              })
              .eq("id", found.id);
            if (found.is_active === false) restored++;
          }
          continue;
        }

        const { error } = await sb.from("locations").insert({
          market_id: p.market_id,
          parent_id: p.id,
          location_type: "attraction",
          name,
          slug,
          country_code: p.country_code ?? "PK",
          created_by: caller.user.id,
          updated_by: caller.user.id,
        });
        /* 23505 means a sibling already has this slug — a district and an
           attraction of the same name, say. Skipping is right: the place is
           already in the tree under another type. */
        if (!error) added++;
        else if (error.code !== "23505") return bad(error.message, 500);
      }

      for (const e of existing) {
        if (wanted.has(e.slug)) continue;
        if (e.is_active === false) continue;
        await sb
          .from("locations")
          .update({ is_active: false, updated_by: caller.user.id })
          .eq("id", e.id);
        deactivated++;
      }

      if (added || restored || deactivated) {
        await audit({
          action: "location.sync_attractions",
          entityType: "location",
          entityId: p.id,
          entityLabel: d.name,
          before: null,
          after: { added, restored, deactivated, destination: d.slug },
        });
      }

      return NextResponse.json({ ok: true, added, restored, deactivated });
    }

    default:
      return bad("Unknown action.");
  }
}

/** Number, or null for empty input. Rejects nothing — the DB has the ranges. */
function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

"use client";

import * as React from "react";

import { ImageUpload } from "@/components/ui/image-upload";
import { PlaceInput } from "@/components/ui/place-input";
import {
  RegisterSteps,
  RegisteredNotice,
  type RegisterStep,
} from "@/components/dashboard/register-steps";
import { type User } from "@/components/auth/auth-context";
import { createProvider, createService } from "@/lib/transport";

/* ============================================================
 * Registering a transport business, in three steps.
 *
 * WHY THE FIRST VEHICLE IS PART OF REGISTRATION
 *   A provider with no vehicles is a row an admin cannot
 *   approve — there is nothing to look at and nothing a
 *   traveller could book. Before this, registering and adding
 *   a vehicle were two separate journeys and someone could
 *   finish the first and never start the second, which is how
 *   you end up with providers who exist and listings that do
 *   not. Asking for one vehicle here means every registration
 *   arrives reviewable.
 *
 *   One, not all of them. The rest are added from the
 *   dashboard, and can be added while approval is pending.
 *
 * WHAT IT ASKS FOR
 *   Eleven fields. The full forms have fifty-seven between
 *   them and every one of those is still there — this is about
 *   which of them a stranger has to answer before they are
 *   allowed to exist.
 * ============================================================ */

const VEHICLE_TYPES = ["Jeep", "Car", "Van", "Coaster", "Bus", "Bike"];

export function TransportRegisterWizard({
  user,
  onDone,
}: {
  user: User;
  /** Called once the provider exists, to reload the dashboard. */
  onDone: () => void;
}) {
  /* Business */
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [whatsapp, setWhatsapp] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [logo, setLogo] = React.useState("");

  /* First vehicle */
  const [title, setTitle] = React.useState("");
  const [vehicleType, setVehicleType] = React.useState(VEHICLE_TYPES[0]);
  const [seats, setSeats] = React.useState("");
  const [pricePerDay, setPricePerDay] = React.useState("");
  const [route, setRoute] = React.useState("");
  const [image, setImage] = React.useState("");

  /* Verification — every one optional.
   *
   * These are what let an admin mark a business Verified, which travellers
   * see as a badge on the listing. Not a gate: a listing without them is
   * approved and live like any other, it simply carries no badge. Making
   * them compulsory would turn the single biggest drop-off point in any
   * signup into a wall, and Rego needs providers more than it needs
   * paperwork from the ones it does not have yet. */
  const [ownerCnic, setOwnerCnic] = React.useState("");
  const [ownerCnicDoc, setOwnerCnicDoc] = React.useState("");
  const [licenseNumber, setLicenseNumber] = React.useState("");
  const [licenseDoc, setLicenseDoc] = React.useState("");
  const [ownershipDoc, setOwnershipDoc] = React.useState("");

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);

  const gaveAnyDocs = Boolean(
    ownerCnic.trim() ||
      ownerCnicDoc.trim() ||
      licenseNumber.trim() ||
      licenseDoc.trim() ||
      ownershipDoc.trim()
  );

  const submit = async () => {
    setSubmitting(true);
    setError("");

    /* The provider first, because the vehicle needs its id. */
    const { data: created, error: pErr } = await createProvider({
      name: name.trim(),
      phone: phone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      location: location.trim() || null,
      logo: logo.trim() || null,
      /* Whatever they gave. Blank stays null rather than an empty string, so
         "not provided" and "provided as nothing" cannot be confused when an
         admin looks at the row. */
      owner_cnic: ownerCnic.trim() || null,
      owner_cnic_doc: ownerCnicDoc.trim() || null,
      license_number: licenseNumber.trim() || null,
      license_doc: licenseDoc.trim() || null,
      ownership_doc: ownershipDoc.trim() || null,
      owner_email: user.email,
    });

    if (pErr || !created) {
      setSubmitting(false);
      setError(pErr?.message ?? "Could not save your business. Please try again.");
      return;
    }

    const { error: sErr } = await createService({
      provider_id: (created as { id: string }).id,
      /* The business name is stored on the vehicle too, not just linked by id.
         That denormalisation is what the public card reads to print "by …",
         and the dashboard's own add-vehicle form has always written it. This
         wizard did not, so a vehicle registered here appeared on the site with
         no owner shown at all — a listing nobody could see the name behind. */
      provider_name: name.trim(),
      title: title.trim(),
      vehicle_type: vehicleType,
      seats: Number(seats) || null,
      price_per_day: Number(pricePerDay) || 0,
      route: route.trim() || null,
      image: image.trim() || null,
      owner_email: user.email,
    });

    setSubmitting(false);

    if (sErr) {
      /* The business saved and the vehicle did not. Deleting the business to
         make the two atomic would throw away the part that worked and make
         them type it again. Say what happened instead — they are registered,
         and the vehicle is one screen away in the dashboard. */
      setError(
        "Your business was saved, but the vehicle could not be added. You can add it from your dashboard in a moment."
      );
      setDone(true);
      return;
    }

    setDone(true);
  };

  if (done) {
    return <RegisteredNotice what="transport business" onContinue={onDone} />;
  }

  const steps: RegisterStep[] = [
    {
      title: "Your business",
      hint: "How travellers will find and contact you.",
      validate: () =>
        name.trim() ? null : "Please enter your business name.",
      content: (
        <>
          <L label="Business name" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="auth-input"
              placeholder="e.g. Hunza Rides & Rentals"
              autoFocus
            />
          </L>
          <div className="grid gap-4 sm:grid-cols-2">
            <L label="Phone">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="auth-input"
                placeholder="+92 3xx…"
                inputMode="tel"
              />
            </L>
            <L label="WhatsApp">
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                className="auth-input"
                placeholder="+92 3xx…"
                inputMode="tel"
              />
            </L>
          </div>
          <L label="Where are you based?">
            <PlaceInput
              value={location}
              onChange={setLocation}
              placeholder="e.g. Gilgit"
            />
          </L>
          <L label="Logo or photo of your business">
            <ImageUpload value={logo} onChange={setLogo} />
          </L>
        </>
      ),
    },
    {
      title: "Your first vehicle",
      hint: "One is enough to get listed — you can add the rest later.",
      validate: () => {
        if (!title.trim()) return "Please give this vehicle or service a name.";
        if (!Number(pricePerDay)) return "Please enter a price per day.";
        return null;
      },
      content: (
        <>
          <L label="What are you offering?" required>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="auth-input"
              placeholder="e.g. Skardu Airport Transfer"
              autoFocus
            />
          </L>
          <div className="grid gap-4 sm:grid-cols-3">
            <L label="Vehicle type">
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="auth-input"
              >
                {VEHICLE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </L>
            <L label="Seats">
              <input
                type="number"
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                className="auth-input"
                inputMode="numeric"
              />
            </L>
            <L label="Price per day (PKR)" required>
              <input
                type="number"
                value={pricePerDay}
                onChange={(e) => setPricePerDay(e.target.value)}
                className="auth-input"
                inputMode="numeric"
              />
            </L>
          </div>
          <L label="Route or area you cover">
            <input
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              className="auth-input"
              placeholder="Skardu – Khaplu"
            />
          </L>
          <L label="Photo of the vehicle">
            <ImageUpload value={image} onChange={setImage} />
          </L>
        </>
      ),
    },
    {
      title: "Verification",
      hint: "Optional. This is what earns the Verified badge on your listing.",
      skipLabel: "Skip for now",
      content: (
        <>
          <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm leading-relaxed text-forest">
            Travellers are booking a stranger&apos;s vehicle in the mountains,
            and a <strong>Verified</strong> badge is the main thing that tells
            them somebody checked. Adding these now means your listing can carry
            it from the day it goes live.
            <span className="mt-2 block text-muted-foreground">
              Your listing does not depend on this — it will be reviewed and can
              go live either way, and you can add these later from your
              dashboard. These documents are seen only by the Rego team and are
              never shown publicly.
            </span>
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <L label="Owner ID (CNIC) number">
              <input
                value={ownerCnic}
                onChange={(e) => setOwnerCnic(e.target.value)}
                className="auth-input"
                inputMode="numeric"
              />
            </L>
            <L label="Licence number">
              <input
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                className="auth-input"
              />
            </L>
          </div>

          <L label="Photo of owner ID">
            <ImageUpload value={ownerCnicDoc} onChange={setOwnerCnicDoc} />
          </L>
          <L label="Licence or permit">
            <ImageUpload value={licenseDoc} onChange={setLicenseDoc} />
          </L>
          <L label="Business registration proof">
            <ImageUpload value={ownershipDoc} onChange={setOwnershipDoc} />
          </L>
        </>
      ),
    },
    {
      title: "Check and submit",
      hint: "Nothing is saved until you submit.",
      content: (
        <div className="space-y-4">
          <Summary
            heading="Your business"
            rows={[
              ["Name", name],
              ["Phone", phone],
              ["WhatsApp", whatsapp],
              ["Based in", location],
            ]}
          />
          <Summary
            heading="Your first vehicle"
            rows={[
              ["Offering", title],
              ["Type", vehicleType],
              ["Seats", seats],
              ["Price per day", pricePerDay ? `PKR ${pricePerDay}` : ""],
              ["Route", route],
            ]}
          />
          {/* Says which of the two outcomes they are heading for, since they
              chose it a screen ago and may not remember choosing. */}
          <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-forest">
            <strong>Verification:</strong>{" "}
            {gaveAnyDocs
              ? "documents attached — the team can consider you for the Verified badge."
              : "skipped. Your listing will still be reviewed and can go live; you can add documents later from your dashboard to earn the Verified badge."}
          </p>

          <p className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-forest">
            The Rego team checks new listings before they go live. You can keep
            adding vehicles and details while yours is being reviewed.
          </p>
        </div>
      ),
    },
  ];

  return (
    <RegisterSteps
      heading="Register your transport business"
      steps={steps}
      submitLabel="Submit for review"
      submitting={submitting}
      error={error}
      onSubmit={submit}
    />
  );
}

/* ------------------------------------------------------------------ */

function L({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-forest">
        {label} {required && <span className="text-gold-600">*</span>}
      </span>
      {children}
    </label>
  );
}

function Summary({
  heading,
  rows,
}: {
  heading: string;
  rows: [string, string][];
}) {
  /* Blank answers are skipped rather than shown as dashes. A review screen
     listing six empty fields reads as a list of things you got wrong. */
  const filled = rows.filter(([, v]) => v.trim());
  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-4">
      <p className="font-display text-sm font-bold text-forest">{heading}</p>
      <dl className="mt-2 space-y-1 text-sm">
        {filled.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="shrink-0 text-muted-foreground">{k}:</dt>
            <dd className="min-w-0 break-words font-medium text-forest">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

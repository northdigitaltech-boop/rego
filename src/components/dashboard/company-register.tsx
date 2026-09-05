"use client";

import * as React from "react";

import { ImageUpload } from "@/components/ui/image-upload";
import { PlaceInput } from "@/components/ui/place-input";
import { useAreaSelection } from "@/components/dashboard/use-area-selection";
import { attachStashedReferral } from "@/lib/referral";
import { CoveragePicker } from "@/components/dashboard/coverage-picker";
import { setCoverage } from "@/lib/service-coverage";
import {
  RegisterSteps,
  RegisteredNotice,
  useVerificationStep,
  verificationSummary,
  type RegisterStep,
} from "@/components/dashboard/register-steps";
import {
  L,
  ReviewFooter,
  Summary,
} from "@/components/dashboard/register-fields";
import { type User } from "@/components/auth/auth-context";
import { createCompany, createPackage } from "@/lib/tour-companies";

/* ============================================================
 * Registering a travel company, and its first tour package.
 *
 * A company with no packages is the emptiest listing on the
 * site: a name, a phone number, and nothing a traveller could
 * book. So one package is part of registering.
 *
 * Price per person, because that is how every tour on Rego is
 * already priced and quoting a group total next to per-person
 * ones is how a traveller ends up comparing two different
 * things.
 * ============================================================ */

export function CompanyRegisterWizard({
  user,
  onDone,
}: {
  user: User;
  onDone: () => void;
}) {
  const [name, setName] = React.useState("");
  const [ownerName, setOwnerName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [whatsapp, setWhatsapp] = React.useState("");
  const [office, setOffice] = React.useState("");
  /* Ids for service_locations, names for the existing service_areas text
     column. Both are kept: the text column is what listing cards render
     today, so dropping it would blank every one of them. */
  const [coverageIds, setCoverageIds] = React.useState<string[]>([]);
  const [coverageNames, setCoverageNames] = React.useState<string[]>([]);
  const [logo, setLogo] = React.useState("");

  const [title, setTitle] = React.useState("");
  /* duration and destination, matching the columns tour_packages actually
     has — it stores a phrase ("5 days") and one destination, not a number
     of days and a list. */
  const [duration, setDuration] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [destination, setDestination] = React.useState("");
  const [image, setImage] = React.useState("");

  const ver = useVerificationStep({ noun: "a company they found online" });

  /* Structured area, alongside the free-text place above. Renders
     nothing until the market module is switched on. */
  const area = useAreaSelection("travel-companies", null, { required: true });

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError("");

    const { data: created, error: cErr } = await createCompany({
      ...area.payload,
      name: name.trim(),
      owner_name: ownerName.trim() || null,
      phone: phone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      office_address: office.trim() || null,
      service_areas: coverageNames,
      logo: logo.trim() || null,
      owner_cnic: ver.values.idNumber.trim() || null,
      owner_cnic_doc: ver.values.idPhoto.trim() || null,
      license_number: ver.values.licenceNumber.trim() || null,
      license_doc: ver.values.licencePhoto.trim() || null,
      ownership_doc: ver.values.registrationProof.trim() || null,
      owner_email: user.email,
    });

    if (cErr || !created) {
      setSubmitting(false);
      setError(cErr?.message ?? "Could not save your company. Please try again.");
      return;
    }

    /* The referral, if they arrived through a team member's link. Fire and
       forget: attachStashedReferral never throws and never blocks — a lost
       attribution is a smaller loss than a failed registration. */
    void attachStashedReferral("tour_companies", (created as { id: string }).id);

    /* After the company exists, because the rows point at its id. A failure
       here must not lose the registration — the company and its package are
       saved either way, and coverage is editable from the dashboard. */
    const coverageProblem = await setCoverage(
      "tour_companies",
      (created as { id: string }).id,
      coverageIds,
      "service_area"
    );

    const { error: pErr } = await createPackage({
      ...area.payload,
      company_id: (created as { id: string }).id,
      /* Same as the vehicle case: the package carries the company name as well
         as the id, because that copy is what the public card prints as
         "by …". The dashboard writes it; this wizard did not. */
      company_name: name.trim(),
      title: title.trim(),
      duration: duration.trim() || null,
      price_per_person: Number(price) || 0,
      destination: destination.trim() || null,
      image: image.trim() || null,
      owner_email: user.email,
    });

    setSubmitting(false);
    if (pErr) {
      setError(
        "Your company was saved, but the package could not be added. You can add it from your dashboard in a moment."
      );
    } else if (coverageProblem) {
      /* Second in priority: a missing package is worse than missing service
         areas, and only one message fits. Both are fixable from the
         dashboard, and the registration itself succeeded either way. */
      setError(coverageProblem);
    }
    setDone(true);
  };

  if (done) return <RegisteredNotice what="travel company" onContinue={onDone} />;

  const steps: RegisterStep[] = [
    {
      title: "Your company",
      hint: "How travellers will find and contact you.",
      validate: () => {
        if (!name.trim()) return "Please enter your company name.";
        if (!office.trim()) return "Please enter your office address or a map link.";
        /* Compulsory only when the picker is actually offering areas. A hard
           requirement on a field that renders nothing would stop registration
           entirely the first time the areas fail to load. */
        return area.requireArea("area");
      },
      content: (
        <>
          <L label="Company name" required>
            <input value={name} onChange={(e) => setName(e.target.value)} className="auth-input" placeholder="e.g. Karakoram Travels" autoFocus />
          </L>
          <L label="Owner / contact name">
            <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="auth-input" />
          </L>
          <div className="grid gap-4 sm:grid-cols-2">
            <L label="Phone">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="auth-input" placeholder="+92 3xx…" inputMode="tel" />
            </L>
            <L label="WhatsApp">
              <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="auth-input" placeholder="+92 3xx…" inputMode="tel" />
            </L>
          </div>
          {/* Was a place-name autocomplete, which produced "Gilgit" and left a
              traveller no way to actually reach the office. A full address or
              a map link is what someone needs to turn up at the door. */}
          <L label="Office address or map link" required>
            <input
              value={office}
              onChange={(e) => setOffice(e.target.value)}
              className="auth-input"
              placeholder="Shop 4, Airport Road, Skardu — or a Google Maps link"
            />
          </L>
          {area.picker}
          {/* Where they WORK, as opposed to the office above. This is what a
              traveller filters by, so an Islamabad company running Skardu
              tours ticks Skardu here. Renders nothing until areas exist. */}
          <CoveragePicker
            serviceSlug="travel-companies"
            value={coverageIds}
            onChange={(ids, names) => {
              setCoverageIds(ids);
              setCoverageNames(names);
            }}
            label="Areas you operate in"
            className="mt-3"
          />
          <L label="Company logo">
            <ImageUpload value={logo} onChange={setLogo} />
          </L>
        </>
      ),
    },
    {
      title: "Your first tour package",
      hint: "One is enough to get listed — add the rest later.",
      validate: () => {
        if (!title.trim()) return "Please name the package.";
        if (!Number(price)) return "Please enter a price per person.";
        return null;
      },
      content: (
        <>
          <L label="Package name" required>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="auth-input" placeholder="e.g. 5-day Hunza & Khunjerab" autoFocus />
          </L>
          <div className="grid gap-4 sm:grid-cols-2">
            <L label="How long">
              <input value={duration} onChange={(e) => setDuration(e.target.value)} className="auth-input" placeholder="e.g. 5 days" />
            </L>
            <L label="Price per person (PKR)" required>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="auth-input" inputMode="numeric" />
            </L>
          </div>
          <L label="Main destination">
            <PlaceInput value={destination} onChange={setDestination} placeholder="e.g. Hunza" />
          </L>
          <L label="A photo from this trip">
            <ImageUpload value={image} onChange={setImage} />
          </L>
        </>
      ),
    },
    ver.step,
    {
      title: "Check and submit",
      hint: "Nothing is saved until you submit.",
      content: (
        <div className="space-y-4">
          <Summary
            heading="Your company"
            rows={[
              ["Name", name],
              ["Contact", ownerName],
              ["Phone", phone],
              ["Office", office],
              ["Areas you operate in", coverageNames.join(", ")],
            ]}
          />
          <Summary
            heading="Your first package"
            rows={[
              ["Package", title],
              ["Length", duration],
              ["Per person", price ? `PKR ${price}` : ""],
              ["Destination", destination],
            ]}
          />
          <ReviewFooter verification={verificationSummary(ver.gaveAny)} />
        </div>
      ),
    },
  ];

  return (
    <RegisterSteps
      heading="Register your travel company"
      steps={steps}
      submitLabel="Submit for review"
      submitting={submitting}
      error={error}
      onSubmit={submit}
    />
  );
}

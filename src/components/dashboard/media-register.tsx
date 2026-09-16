"use client";

import * as React from "react";

import { ImageUpload } from "@/components/ui/image-upload";
import { PlaceInput } from "@/components/ui/place-input";
import { NameInput } from "@/components/ui/name-input";
import { useAreaSelection } from "@/components/dashboard/use-area-selection";
import { attachStashedReferral } from "@/lib/referral";
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
  toList,
} from "@/components/dashboard/register-fields";
import { type User } from "@/components/auth/auth-context";
import { createMediaProvider } from "@/lib/media";
import { createMediaService } from "@/lib/media-services";

/* ============================================================
 * Registering a photographer, videographer or drone pilot.
 *
 * Service type is asked first and as a choice, because it is
 * the one thing a traveller filters on here and because
 * "photographer" and "drone pilot" are different searches. It
 * was free text before, which is why it could not be filtered
 * on reliably.
 * ============================================================ */

const SERVICE_TYPES = [
  "Photographer",
  "Videographer",
  "Photo & video",
  "Drone pilot",
];

export function MediaRegisterWizard({
  user,
  onDone,
}: {
  user: User;
  onDone: () => void;
}) {
  const [name, setName] = React.useState(user.name ?? "");
  const [serviceType, setServiceType] = React.useState(SERVICE_TYPES[0]);
  const [phone, setPhone] = React.useState("");
  const [whatsapp, setWhatsapp] = React.useState("");
  const [city, setCity] = React.useState("");
  const [languages, setLanguages] = React.useState("");
  const [logo, setLogo] = React.useState("");

  const [title, setTitle] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [duration, setDuration] = React.useState("");

  const ver = useVerificationStep({
    noun: "someone they found online",
    /* A freelance photographer has no certificate of incorporation. */
    fields: { registrationProof: false },
  });

  /* Structured area, alongside the free-text place above. Renders
     nothing until the market module is switched on. */
  const area = useAreaSelection("photographers");

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError("");

    const { data: created, error: pErr } = await createMediaProvider({
      ...area.payload,
      name: name.trim(),
      service_type: serviceType,
      phone: phone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      city: city.trim() || null,
      location: city.trim() || null,
      languages: toList(languages),
      logo: logo.trim() || null,
      starting_price: Number(price) || 0,
      cnic: ver.values.idNumber.trim() || null,
      cnic_doc: ver.values.idPhoto.trim() || null,
      license_doc: ver.values.licencePhoto.trim() || null,
      owner_email: user.email,
    });

    if (pErr || !created) {
      setSubmitting(false);
      setError(pErr?.message ?? "Could not save your profile. Please try again.");
      return;
    }

    /* The referral, if they arrived through a team member's link. Fire and
       forget: attachStashedReferral never throws and never blocks — a lost
       attribution is a smaller loss than a failed registration. */
    void attachStashedReferral("media_providers", (created as { id: string }).id);

    const { error: sErr } = await createMediaService({
      provider_id: (created as { id: string }).id,
      title: title.trim(),
      price: Number(price) || 0,
      duration: duration.trim() || null,
      owner_email: user.email,
    });

    setSubmitting(false);
    if (sErr) {
      setError(
        "Your profile was saved, but the package could not be added. You can add it from your dashboard in a moment."
      );
    }
    setDone(true);
  };

  if (done) return <RegisteredNotice what="profile" onContinue={onDone} />;

  const steps: RegisterStep[] = [
    {
      title: "About you",
      hint: "This is what a traveller sees first.",
      validate: () => (name.trim() ? null : "Please enter your name."),
      content: (
        <>
          <L label="Your name or studio name" required>
            <NameInput value={name} onChange={setName} className="auth-input" autoFocus />
          </L>
          <L label="What do you do?">
            <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="auth-input">
              {SERVICE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </L>
          <div className="grid gap-4 sm:grid-cols-2">
            <L label="Phone">
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className="auth-input" placeholder="+92 3xx…" inputMode="tel" />
            </L>
            <L label="WhatsApp">
              <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className="auth-input" placeholder="+92 3xx…" inputMode="tel" />
            </L>
          </div>
          <L label="Where are you based?">
            <PlaceInput value={city} onChange={setCity} placeholder="e.g. Skardu" />
          </L>
          {area.picker}
          <L label="Languages you speak">
            <input value={languages} onChange={(e) => setLanguages(e.target.value)} className="auth-input" placeholder="English, Urdu, Balti" />
          </L>
          <L label="Your photo or logo">
            <ImageUpload value={logo} onChange={setLogo} />
          </L>
        </>
      ),
    },
    {
      title: "Your first package",
      hint: "One is enough to get listed — add more later.",
      validate: () => {
        if (!title.trim()) return "Please name the package you offer.";
        if (!Number(price)) return "Please enter a price.";
        return null;
      },
      content: (
        <>
          <L label="Package" required>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="auth-input" placeholder="e.g. Half-day shoot, wedding coverage" autoFocus />
          </L>
          <div className="grid gap-4 sm:grid-cols-2">
            <L label="Price (PKR)" required>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="auth-input" inputMode="numeric" />
            </L>
            <L label="How long">
              <input value={duration} onChange={(e) => setDuration(e.target.value)} className="auth-input" placeholder="e.g. 4 hours, 1 day" />
            </L>
          </div>
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
            heading="You"
            rows={[
              ["Name", name],
              ["Does", serviceType],
              ["Phone", phone],
              ["Based in", city],
              ["Languages", languages],
            ]}
          />
          <Summary
            heading="Your first package"
            rows={[
              ["Package", title],
              ["Price", price ? `PKR ${price}` : ""],
              ["Length", duration],
            ]}
          />
          <ReviewFooter verification={verificationSummary(ver.gaveAny)} />
        </div>
      ),
    },
  ];

  return (
    <RegisterSteps
      heading="Register as a photographer or videographer"
      steps={steps}
      submitLabel="Submit for review"
      submitting={submitting}
      error={error}
      onSubmit={submit}
    />
  );
}

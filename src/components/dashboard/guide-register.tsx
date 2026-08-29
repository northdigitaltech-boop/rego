"use client";

import * as React from "react";

import { ImageUpload } from "@/components/ui/image-upload";
import { PlaceInput } from "@/components/ui/place-input";
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
import { createGuide } from "@/lib/tour-companies";
import { createGuideService } from "@/lib/guide-services";

/* ============================================================
 * Registering as a tour guide.
 *
 * A guide is a person rather than a company, so the first step
 * asks for a name and a photo instead of a logo and a
 * registration number — and the "first listing" is one service
 * they offer, priced, so a traveller has something to book.
 *
 * Languages are asked for here rather than left to the full
 * form later. It is the question travellers ask about guides
 * more than any other, and it costs one line.
 * ============================================================ */

export function GuideRegisterWizard({
  user,
  onDone,
}: {
  user: User;
  onDone: () => void;
}) {
  const [name, setName] = React.useState(user.name ?? "");
  const [phone, setPhone] = React.useState("");
  const [whatsapp, setWhatsapp] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [languages, setLanguages] = React.useState("");
  const [image, setImage] = React.useState("");

  const [title, setTitle] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [duration, setDuration] = React.useState("");

  const ver = useVerificationStep({
    noun: "a guide",
    /* No business registration: a guide is not a company, and asking for a
       certificate of incorporation would be a question with no answer. */
    fields: { registrationProof: false },
  });

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError("");

    const { data: created, error: gErr } = await createGuide({
      name: name.trim(),
      phone: phone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      location: location.trim() || null,
      languages: toList(languages),
      image: image.trim() || null,
      price_per_day: Number(price) || 0,
      cnic: ver.values.idNumber.trim() || null,
      cnic_doc: ver.values.idPhoto.trim() || null,
      license_doc: ver.values.licencePhoto.trim() || null,
      owner_email: user.email,
    });

    if (gErr || !created) {
      setSubmitting(false);
      setError(gErr?.message ?? "Could not save your profile. Please try again.");
      return;
    }

    const { error: sErr } = await createGuideService({
      guide_id: (created as { id: string }).id,
      title: title.trim(),
      price: Number(price) || 0,
      duration: duration.trim() || null,
      owner_email: user.email,
    });

    setSubmitting(false);
    if (sErr) {
      /* The profile saved. Keeping it and saying so beats deleting the part
         that worked and making them type it all again. */
      setError(
        "Your profile was saved, but the service could not be added. You can add it from your dashboard in a moment."
      );
    }
    setDone(true);
  };

  if (done) return <RegisteredNotice what="guide profile" onContinue={onDone} />;

  const steps: RegisterStep[] = [
    {
      title: "About you",
      hint: "This is what a traveller sees first.",
      validate: () => (name.trim() ? null : "Please enter your name."),
      content: (
        <>
          <L label="Your name" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="auth-input"
              autoFocus
            />
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
            <PlaceInput value={location} onChange={setLocation} placeholder="e.g. Skardu" />
          </L>
          <L label="Languages you speak">
            <input
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              className="auth-input"
              placeholder="English, Urdu, Balti"
            />
          </L>
          <L label="Your photo">
            <ImageUpload value={image} onChange={setImage} />
          </L>
        </>
      ),
    },
    {
      title: "What you offer",
      hint: "One service is enough to get listed — add more later.",
      validate: () => {
        if (!title.trim()) return "Please name the service you offer.";
        if (!Number(price)) return "Please enter a day rate.";
        return null;
      },
      content: (
        <>
          <L label="Service" required>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="auth-input"
              placeholder="e.g. Deosai day trip, K2 base camp trek"
              autoFocus
            />
          </L>
          <div className="grid gap-4 sm:grid-cols-2">
            <L label="Rate per day (PKR)" required>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="auth-input" inputMode="numeric" />
            </L>
            <L label="Typical length">
              <input value={duration} onChange={(e) => setDuration(e.target.value)} className="auth-input" placeholder="e.g. 1 day, 5 days" />
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
              ["Phone", phone],
              ["Based in", location],
              ["Languages", languages],
            ]}
          />
          <Summary
            heading="Your first service"
            rows={[
              ["Service", title],
              ["Rate per day", price ? `PKR ${price}` : ""],
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
      heading="Register as a guide"
      steps={steps}
      submitLabel="Submit for review"
      submitting={submitting}
      error={error}
      onSubmit={submit}
    />
  );
}

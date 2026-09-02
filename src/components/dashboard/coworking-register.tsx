"use client";

import * as React from "react";

import { ImageUpload } from "@/components/ui/image-upload";
import { PlaceInput } from "@/components/ui/place-input";
import { useAreaSelection } from "@/components/dashboard/use-area-selection";
import {
  RegisterSteps,
  RegisteredNotice,
  type RegisterStep,
} from "@/components/dashboard/register-steps";
import { L, Summary } from "@/components/dashboard/register-fields";
import { type User } from "@/components/auth/auth-context";
import { createCoworking } from "@/lib/coworking";

/* ============================================================
 * Registering a co-working space.
 *
 * NO VERIFICATION STEP HERE, ON PURPOSE
 *   coworking_spaces has no columns for an ID number, a licence
 *   or a registration document. Asking for them would mean
 *   collecting files with nowhere to put them, and adding the
 *   columns is a migration nobody asked for. So this wizard is
 *   three steps, and verification for co-working is a separate
 *   decision to make deliberately rather than a gap to paper
 *   over.
 *
 * A DESK PRICE IS THE LISTING
 *   Unlike hotels or transport there is no child table — the
 *   space is the whole listing. What makes it bookable is a
 *   price, so the hot-desk rate is asked for here rather than
 *   left to the full form.
 * ============================================================ */

export function CoworkingRegisterWizard({
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
  const [city, setCity] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [logo, setLogo] = React.useState("");
  const [description, setDescription] = React.useState("");

  const [seats, setSeats] = React.useState("");
  const [hotDesk, setHotDesk] = React.useState("");
  const [privateOffice, setPrivateOffice] = React.useState("");

  /* Structured area, alongside the free-text place above. Renders
     nothing until the market module is switched on. */
  const area = useAreaSelection("coworking");

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError("");

    const { error: e } = await createCoworking({
      ...area.payload,
      name: name.trim(),
      owner_name: ownerName.trim() || null,
      phone: phone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      city: city.trim() || null,
      location: city.trim() || null,
      address: address.trim() || null,
      logo: logo.trim() || null,
      description: description.trim() || null,
      seating_capacity: Number(seats) || null,
      hot_desk_price: Number(hotDesk) || null,
      private_office_price: Number(privateOffice) || null,
      owner_email: user.email,
      status: "pending",
    });

    setSubmitting(false);
    if (e) {
      setError(e.message);
      return;
    }
    setDone(true);
  };

  if (done)
    return <RegisteredNotice what="co-working space" onContinue={onDone} />;

  const steps: RegisterStep[] = [
    {
      title: "Your space",
      hint: "How people will find you.",
      validate: () => (name.trim() ? null : "Please enter the name of your space."),
      content: (
        <>
          <L label="Name of the space" required>
            <input value={name} onChange={(e) => setName(e.target.value)} className="auth-input" placeholder="e.g. Karakoram Co-work" autoFocus />
          </L>
          <L label="Owner / manager name">
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
          <L label="Town or city">
            <PlaceInput value={city} onChange={setCity} placeholder="e.g. Gilgit" />
          </L>
          {area.picker}
          <L label="Address">
            <input value={address} onChange={(e) => setAddress(e.target.value)} className="auth-input" placeholder="Street, landmark, floor" />
          </L>
          <L label="Photo of the space">
            <ImageUpload value={logo} onChange={setLogo} />
          </L>
        </>
      ),
    },
    {
      title: "Desks and prices",
      hint: "A price is what makes the listing bookable.",
      validate: () =>
        Number(hotDesk) || Number(privateOffice)
          ? null
          : "Please enter at least one price.",
      content: (
        <>
          <L label="How many people can work here?">
            <input type="number" value={seats} onChange={(e) => setSeats(e.target.value)} className="auth-input" inputMode="numeric" autoFocus />
          </L>
          <div className="grid gap-4 sm:grid-cols-2">
            <L label="Hot desk, per day (PKR)">
              <input type="number" value={hotDesk} onChange={(e) => setHotDesk(e.target.value)} className="auth-input" inputMode="numeric" />
            </L>
            <L label="Private office, per day (PKR)">
              <input type="number" value={privateOffice} onChange={(e) => setPrivateOffice(e.target.value)} className="auth-input" inputMode="numeric" />
            </L>
          </div>
          <L label="What is it like to work here?">
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="auth-input resize-none" placeholder="Wifi speed, power backup, quiet or busy, coffee" />
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
            heading="Your space"
            rows={[
              ["Name", name],
              ["Phone", phone],
              ["Town", city],
              ["Address", address],
            ]}
          />
          <Summary
            heading="Desks"
            rows={[
              ["Capacity", seats],
              ["Hot desk", hotDesk ? `PKR ${hotDesk} / day` : ""],
              ["Private office", privateOffice ? `PKR ${privateOffice} / day` : ""],
            ]}
          />
          <p className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-forest">
            The Rego team checks new listings before they go live. You can keep
            adding photos and details while yours is being reviewed.
          </p>
        </div>
      ),
    },
  ];

  return (
    <RegisterSteps
      heading="List your co-working space"
      steps={steps}
      submitLabel="Submit for review"
      submitting={submitting}
      error={error}
      onSubmit={submit}
    />
  );
}

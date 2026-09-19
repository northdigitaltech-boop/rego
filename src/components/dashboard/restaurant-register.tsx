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
import { createRestaurant, createMenuItem } from "@/lib/restaurants";

/* ============================================================
 * Registering a restaurant, and its first menu item.
 *
 * A restaurant listing with an empty menu tells a traveller
 * nothing — not what kind of food, not what it costs. One dish
 * answers both, so one dish is part of registering.
 *
 * Cuisine is a free-text list rather than a fixed set: the food
 * in Gilgit-Baltistan does not sort neatly into the categories
 * a delivery app would use, and a closed list would push every
 * Balti kitchen into "Other".
 * ============================================================ */

export function RestaurantRegisterWizard({
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
  const [cuisine, setCuisine] = React.useState("");
  const [hours, setHours] = React.useState("");
  const [logo, setLogo] = React.useState("");

  const [dish, setDish] = React.useState("");
  const [dishPrice, setDishPrice] = React.useState("");
  const [dishDesc, setDishDesc] = React.useState("");

  const ver = useVerificationStep({
    noun: "a kitchen they have never seen",
    /* Restaurants have no licence_number column; the photo covers it. */
    fields: { licenceNumber: false, registrationProof: false },
  });

  /* Structured area, alongside the free-text place above. Renders
     nothing until the market module is switched on. */
  const area = useAreaSelection("restaurants");

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError("");

    const { data: created, error: rErr } = await createRestaurant({
      ...area.payload,
      name: name.trim(),
      owner_name: ownerName.trim() || null,
      phone: phone.trim() || null,
      whatsapp: whatsapp.trim() || null,
      city: city.trim() || null,
      location: city.trim() || null,
      address: address.trim() || null,
      cuisine_types: toList(cuisine),
      opening_hours: hours.trim() || null,
      logo: logo.trim() || null,
      owner_cnic: ver.values.idNumber.trim() || null,
      owner_cnic_doc: ver.values.idPhoto.trim() || null,
      license_doc: ver.values.licencePhoto.trim() || null,
      owner_email: user.email,
    });

    if (rErr || !created) {
      setSubmitting(false);
      setError(rErr?.message ?? "Could not save your restaurant. Please try again.");
      return;
    }

    /* The referral, if they arrived through a team member's link. Fire and
       forget: attachStashedReferral never throws and never blocks — a lost
       attribution is a smaller loss than a failed registration. */
    void attachStashedReferral("restaurants", (created as { id: string }).id);

    const { error: mErr } = await createMenuItem({
      restaurant_id: (created as { id: string }).id,
      name: dish.trim(),
      price: Number(dishPrice) || 0,
      description: dishDesc.trim() || null,
    });

    setSubmitting(false);
    if (mErr) {
      setError(
        "Your restaurant was saved, but the menu item could not be added. You can add it from your dashboard in a moment."
      );
    }
    setDone(true);
  };

  if (done) return <RegisteredNotice what="restaurant" onContinue={onDone} />;

  const steps: RegisterStep[] = [
    {
      title: "Your restaurant",
      hint: "How travellers will find you.",
      validate: () => (name.trim() ? null : "Please enter the restaurant name."),
      content: (
        <>
          <L label="Restaurant name" required>
            <NameInput value={name} onChange={setName} className="auth-input" autoFocus />
          </L>
          <L label="Owner / manager name">
            <NameInput value={ownerName} onChange={setOwnerName} className="auth-input" />
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
            <PlaceInput value={city} onChange={setCity} placeholder="e.g. Skardu" />
          </L>
          {area.picker}
          <L label="Address">
            <input value={address} onChange={(e) => setAddress(e.target.value)} className="auth-input" placeholder="Street, landmark" />
          </L>
          <div className="grid gap-4 sm:grid-cols-2">
            <L label="Kind of food">
              <input value={cuisine} onChange={(e) => setCuisine(e.target.value)} className="auth-input" placeholder="Balti, Pakistani, Chinese" />
            </L>
            <L label="Opening hours">
              <input value={hours} onChange={(e) => setHours(e.target.value)} className="auth-input" placeholder="e.g. 8 AM – 11 PM" />
            </L>
          </div>
          <L label="Photo of your restaurant">
            <ImageUpload folder="restaurants" value={logo} onChange={setLogo} />
          </L>
        </>
      ),
    },
    {
      title: "One dish from your menu",
      hint: "Enough to show travellers what you serve — add the full menu later.",
      validate: () => {
        if (!dish.trim()) return "Please name one dish.";
        if (!Number(dishPrice)) return "Please enter its price.";
        return null;
      },
      content: (
        <>
          <L label="Dish" required>
            <input value={dish} onChange={(e) => setDish(e.target.value)} className="auth-input" placeholder="e.g. Chapshuro, Mutton karahi" autoFocus />
          </L>
          <L label="Price (PKR)" required>
            <input type="number" value={dishPrice} onChange={(e) => setDishPrice(e.target.value)} className="auth-input" inputMode="numeric" />
          </L>
          <L label="Short description">
            <textarea rows={2} value={dishDesc} onChange={(e) => setDishDesc(e.target.value)} className="auth-input resize-none" />
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
            heading="Your restaurant"
            rows={[
              ["Name", name],
              ["Phone", phone],
              ["Town", city],
              ["Food", cuisine],
              ["Hours", hours],
            ]}
          />
          <Summary
            heading="First menu item"
            rows={[
              ["Dish", dish],
              ["Price", dishPrice ? `PKR ${dishPrice}` : ""],
            ]}
          />
          <ReviewFooter verification={verificationSummary(ver.gaveAny)} />
        </div>
      ),
    },
  ];

  return (
    <RegisterSteps
      heading="Register your restaurant"
      steps={steps}
      submitLabel="Submit for review"
      submitting={submitting}
      error={error}
      onSubmit={submit}
    />
  );
}

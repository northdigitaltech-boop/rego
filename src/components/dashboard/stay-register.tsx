"use client";

import * as React from "react";

import { ImageUpload } from "@/components/ui/image-upload";
import { PlaceInput } from "@/components/ui/place-input";
import { useAreaSelection } from "@/components/dashboard/use-area-selection";
import {
  RegisterSteps,
  RegisteredNotice,
  useVerificationStep,
  verificationSummary,
  type RegisterStep,
} from "@/components/dashboard/register-steps";
import { L, ReviewFooter, Summary } from "@/components/dashboard/register-fields";
import { type User } from "@/components/auth/auth-context";
import { createHotel, addRoom } from "@/lib/hotels";
import { createHomestay, replaceHomestayRooms } from "@/lib/homestays";
import { createHostel, replaceHostelRooms } from "@/lib/hostels";

/* ============================================================
 * Registering a hotel, homestay or hostel.
 *
 * THESE THREE ARE SHAPED DIFFERENTLY FROM THE REST
 *   Everywhere else there is a provider and then its listings.
 *   Here the property IS the listing, and one owner can have
 *   several — so "registration" means adding the first one,
 *   and every one after that uses the existing form.
 *
 * ONE ROOM, ALWAYS
 *   A stay with no rooms has no price and nothing to book.
 *   The homestay and hostel forms already refused to save
 *   without one; hotels did not, which is how a hotel could
 *   exist with nothing bookable in it. Now all three ask, and
 *   the room's price becomes the property's starting price —
 *   which is what the public cards show.
 *
 * The three differ by about four strings, so they share one
 * component rather than three near-copies that would drift.
 * ============================================================ */

export type StayKind = "hotel" | "homestay" | "hostel";

const COPY: Record<
  StayKind,
  {
    heading: string;
    noun: string;
    /** What the property is called on step 1. */
    nameLabel: string;
    namePlaceholder: string;
    /** What a bookable unit is called on step 2. */
    roomWord: string;
    roomPlaceholder: string;
    categoryLabel: string;
  }
> = {
  hotel: {
    heading: "Register your hotel",
    noun: "a hotel they have never stayed in",
    nameLabel: "Hotel name",
    namePlaceholder: "e.g. Shangrila Resort",
    roomWord: "room",
    roomPlaceholder: "e.g. Deluxe double, Family suite",
    categoryLabel: "Hotels & Resorts",
  },
  homestay: {
    heading: "Register your homestay",
    noun: "a family they have never met",
    nameLabel: "Homestay name",
    namePlaceholder: "e.g. Karim Family Homestay",
    roomWord: "room",
    roomPlaceholder: "e.g. Guest room, Whole floor",
    categoryLabel: "Homestays",
  },
  hostel: {
    heading: "Register your hostel",
    noun: "a hostel they have never seen",
    nameLabel: "Hostel name",
    namePlaceholder: "e.g. Base Camp Hostel",
    roomWord: "room or dorm",
    roomPlaceholder: "e.g. 6-bed mixed dorm, Private twin",
    categoryLabel: "Hostels",
  },
};

export function StayRegisterWizard({
  kind,
  user,
  onDone,
}: {
  kind: StayKind;
  user: User;
  onDone: () => void;
}) {
  const c = COPY[kind];

  /* Structured area, alongside the free-text town above. The service slug
     follows `kind`: hotels, homestays and hostels are three categories in
     service_categories, and an admin may open an area to one and not another. */
  const area = useAreaSelection(`${kind}s`);

  const [title, setTitle] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [image, setImage] = React.useState("");
  const [description, setDescription] = React.useState("");

  const [roomName, setRoomName] = React.useState("");
  const [roomPrice, setRoomPrice] = React.useState("");
  const [roomGuests, setRoomGuests] = React.useState("");
  const [roomUnits, setRoomUnits] = React.useState("");

  const ver = useVerificationStep({ noun: c.noun });

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError("");

    const price = Number(roomPrice) || 0;
    const units = Number(roomUnits) || 1;

    /* Shared by all three tables. The room's price is the property's
       starting price, because that is the number the public cards print
       under the name — leaving it at zero shows "PKR 0 / night". */
    const base = {
      ...area.payload,
      title: title.trim(),
      location: location.trim(),
      address: address.trim() || null,
      price,
      unit: "night",
      image: image.trim() || null,
      description: description.trim() || null,
      total_rooms: units,
      owner_cnic: ver.values.idNumber.trim() || null,
      owner_cnic_doc: ver.values.idPhoto.trim() || null,
      license_doc: ver.values.licencePhoto.trim() || null,
      ownership_doc: ver.values.registrationProof.trim() || null,
      reg_number: ver.values.licenceNumber.trim() || null,
      owner_email: user.email,
    };

    let createdId: string | null = null;
    let createError: string | null = null;

    if (kind === "hotel") {
      const { data, error: e } = await createHotel({
        ...base,
        category_label: c.categoryLabel,
      });
      createdId = (data as { id?: string } | null)?.id ?? null;
      createError = e?.message ?? null;
    } else if (kind === "homestay") {
      const { data, error: e } = await createHomestay({
        ...base,
        category_label: c.categoryLabel,
      });
      createdId = (data as { id?: string } | null)?.id ?? null;
      createError = e?.message ?? null;
    } else {
      const { data, error: e } = await createHostel({
        ...base,
        category_label: c.categoryLabel,
      });
      createdId = (data as { id?: string } | null)?.id ?? null;
      createError = e?.message ?? null;
    }

    if (createError || !createdId) {
      setSubmitting(false);
      setError(createError ?? "Could not save. Please try again.");
      return;
    }

    /* Then the room. Each table stores them differently — hotels one at a
       time, the other two as a replaced set — so this is not one call. */
    let roomError = false;
    try {
      if (kind === "hotel") {
        const { error: e } = await addRoom({
          hotel_id: createdId,
          name: roomName.trim(),
          price,
          guests: Number(roomGuests) || 2,
          beds: "",
          features: [],
          total_units: units,
        });
        roomError = Boolean(e);
      } else {
        const rooms = [
          {
            name: roomName.trim(),
            price,
            max_guests: Number(roomGuests) || 2,
            total_units: units,
          },
        ];
        if (kind === "homestay") await replaceHomestayRooms(createdId, rooms);
        else await replaceHostelRooms(createdId, rooms);
      }
    } catch {
      roomError = true;
    }

    setSubmitting(false);
    if (roomError) {
      setError(
        `Your ${kind} was saved, but the ${c.roomWord} could not be added. You can add it from your dashboard in a moment.`
      );
    }
    setDone(true);
  };

  if (done) return <RegisteredNotice what={kind} onContinue={onDone} />;

  const steps: RegisterStep[] = [
    {
      title: `Your ${kind}`,
      hint: "How travellers will find you.",
      validate: () => {
        if (!title.trim()) return `Please enter the ${kind} name.`;
        if (!location.trim()) return "Please say where it is.";
        return null;
      },
      content: (
        <>
          <L label={c.nameLabel} required>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="auth-input"
              placeholder={c.namePlaceholder}
              autoFocus
            />
          </L>
          <L label="Town or valley" required>
            <PlaceInput
              value={location}
              onChange={setLocation}
              placeholder="e.g. Skardu"
            />
          </L>
          {area.picker}
          <L label="Address">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="auth-input"
              placeholder="Street, landmark"
            />
          </L>
          <L label="Main photo">
            <ImageUpload value={image} onChange={setImage} />
          </L>
          <L label="A line or two about the place">
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="auth-input resize-none"
            />
          </L>
        </>
      ),
    },
    {
      title: `Your first ${c.roomWord}`,
      hint: `A ${kind} with no ${c.roomWord} has no price and nothing to book. Add more later.`,
      validate: () => {
        if (!roomName.trim()) return `Please name one ${c.roomWord}.`;
        if (!Number(roomPrice)) return "Please enter a price per night.";
        return null;
      },
      content: (
        <>
          <L label={`What is this ${c.roomWord} called?`} required>
            <input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              className="auth-input"
              placeholder={c.roomPlaceholder}
              autoFocus
            />
          </L>
          <div className="grid gap-4 sm:grid-cols-3">
            <L label="Price per night (PKR)" required>
              <input
                type="number"
                value={roomPrice}
                onChange={(e) => setRoomPrice(e.target.value)}
                className="auth-input"
                inputMode="numeric"
              />
            </L>
            <L label="Sleeps">
              <input
                type="number"
                value={roomGuests}
                onChange={(e) => setRoomGuests(e.target.value)}
                className="auth-input"
                inputMode="numeric"
                placeholder="2"
              />
            </L>
            <L label={`How many like this`}>
              <input
                type="number"
                value={roomUnits}
                onChange={(e) => setRoomUnits(e.target.value)}
                className="auth-input"
                inputMode="numeric"
                placeholder="1"
              />
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
            heading={`Your ${kind}`}
            rows={[
              ["Name", title],
              ["Where", location],
              ["Address", address],
            ]}
          />
          <Summary
            heading={`First ${c.roomWord}`}
            rows={[
              ["Name", roomName],
              ["Per night", roomPrice ? `PKR ${roomPrice}` : ""],
              ["Sleeps", roomGuests],
              ["How many", roomUnits],
            ]}
          />
          <ReviewFooter verification={verificationSummary(ver.gaveAny)} />
        </div>
      ),
    },
  ];

  return (
    <RegisterSteps
      heading={c.heading}
      steps={steps}
      submitLabel="Submit for review"
      submitting={submitting}
      error={error}
      onSubmit={submit}
    />
  );
}

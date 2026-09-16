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
  type RegisterStep,
} from "@/components/dashboard/register-steps";
import { L, Summary } from "@/components/dashboard/register-fields";
import { type User } from "@/components/auth/auth-context";
import {
  ALL_ACTIVITY_CATEGORIES,
  DIFFICULTIES,
  INDOOR_SLUGS,
  PRICE_UNITS,
  createActivity,
} from "@/lib/activities";

/* ============================================================
 * Registering a first activity.
 *
 * The activity IS the listing — there is no provider row above
 * it — so this is the same shape as the stays: stepped for the
 * first one, the existing form for every one after.
 *
 * NO VERIFICATION STEP
 *   The activities table has no columns for an ID or a permit.
 *   Collecting files with nowhere to store them would be worse
 *   than not asking, and adding columns is a migration nobody
 *   requested. Worth deciding on its own — a trekking operator
 *   is exactly the kind of provider a traveller would want
 *   checked.
 *
 * DIFFICULTY IS ASKED FOR OUTDOOR ACTIVITIES ONLY
 *   "Moderate" means something on a trek and nothing in a
 *   snooker club.
 * ============================================================ */

export function ActivityRegisterWizard({
  user,
  onDone,
}: {
  user: User;
  onDone: () => void;
}) {
  const [title, setTitle] = React.useState("");
  /* Typed as string, not the union: the value comes out of a <select>,
     which yields string. Narrowing it would mean a cast on every change. */
  const [category, setCategory] = React.useState<string>(
    ALL_ACTIVITY_CATEGORIES[0].slug
  );
  const [businessName, setBusinessName] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [meetingPoint, setMeetingPoint] = React.useState("");
  const [image, setImage] = React.useState("");

  const [price, setPrice] = React.useState("");
  const [priceUnit, setPriceUnit] = React.useState<string>(PRICE_UNITS[0]);
  const [duration, setDuration] = React.useState("");
  const [difficulty, setDifficulty] = React.useState<string>(DIFFICULTIES[0]);
  const [description, setDescription] = React.useState("");

  const isIndoor = (INDOOR_SLUGS as readonly string[]).includes(category);

  /* Structured area, alongside the free-text place above. Renders
     nothing until the market module is switched on. */
  const area = useAreaSelection("activities");

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError("");

    const { data: created, error: e } = await createActivity({
      ...area.payload,
      title: title.trim(),
      category,
      activity_kind: isIndoor ? "indoor" : "outdoor",
      business_name: businessName.trim() || null,
      location: location.trim() || null,
      city: location.trim() || null,
      meeting_point: meetingPoint.trim() || null,
      image: image.trim() || null,
      price: Number(price) || 0,
      price_unit: priceUnit,
      duration: duration.trim() || null,
      /* Only where it means something. */
      difficulty: isIndoor ? null : difficulty,
      description: description.trim() || null,
      owner_email: user.email,
      status: "pending",
    });

    setSubmitting(false);
    if (e) {
      setError(e.message);
      return;
    }

    /* The referral, if they arrived through a team member's link. Fire and
       forget — a lost attribution is a smaller loss than a failed
       registration. */
    void attachStashedReferral("activities", (created as { id?: string } | null)?.id ?? "");
    setDone(true);
  };

  if (done) return <RegisteredNotice what="activity" onContinue={onDone} />;

  const steps: RegisterStep[] = [
    {
      title: "The activity",
      hint: "What a traveller will be booking.",
      validate: () => (title.trim() ? null : "Please name the activity."),
      content: (
        <>
          <L label="What is it called?" required>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="auth-input"
              placeholder="e.g. Sarfaranga jeep safari"
              autoFocus
            />
          </L>
          <L label="Kind of activity">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="auth-input"
            >
              {ALL_ACTIVITY_CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </L>
          <L label="Business name">
            <NameInput
              value={businessName}
              onChange={setBusinessName}
              className="auth-input"
              placeholder="Leave blank if you run this yourself"
            />
          </L>
          <L label="Where does it happen?">
            <PlaceInput value={location} onChange={setLocation} placeholder="e.g. Skardu" />
          </L>
          {area.picker}
          <L label="Where do people meet you?">
            <input
              value={meetingPoint}
              onChange={(e) => setMeetingPoint(e.target.value)}
              className="auth-input"
              placeholder="e.g. Shangrila gate"
            />
          </L>
          <L label="A photo of it">
            <ImageUpload value={image} onChange={setImage} />
          </L>
        </>
      ),
    },
    {
      title: "Price and details",
      hint: "A price is what makes it bookable.",
      validate: () => (Number(price) ? null : "Please enter a price."),
      content: (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <L label="Price (PKR)" required>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="auth-input"
                inputMode="numeric"
                autoFocus
              />
            </L>
            <L label="Per">
              <select
                value={priceUnit}
                onChange={(e) => setPriceUnit(e.target.value)}
                className="auth-input"
              >
                {PRICE_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </L>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <L label="How long">
              <input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="auth-input"
                placeholder="e.g. 3 hours, 1 day"
              />
            </L>
            {/* Difficulty is meaningless indoors, so it is not asked. */}
            {!isIndoor && (
              <L label="How hard is it?">
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="auth-input"
                >
                  {DIFFICULTIES.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </L>
            )}
          </div>
          <L label="What happens on it?">
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="auth-input resize-none"
              placeholder="What travellers do, what to bring, what is included"
            />
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
            heading="The activity"
            rows={[
              ["Name", title],
              [
                "Kind",
                ALL_ACTIVITY_CATEGORIES.find((c) => c.slug === category)?.name ?? "",
              ],
              ["Where", location],
              ["Meeting point", meetingPoint],
            ]}
          />
          <Summary
            heading="Price"
            rows={[
              ["Price", price ? `PKR ${price} per ${priceUnit}` : ""],
              ["Length", duration],
              ["Difficulty", isIndoor ? "" : difficulty],
            ]}
          />
          <p className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-forest">
            The Rego team checks new listings before they go live. You can add
            more activities and details while yours is being reviewed.
          </p>
        </div>
      ),
    },
  ];

  return (
    <RegisterSteps
      heading="List your first activity"
      steps={steps}
      submitLabel="Submit for review"
      submitting={submitting}
      error={error}
      onSubmit={submit}
    />
  );
}

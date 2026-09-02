"use client";

import * as React from "react";
import { Building2, UserRound } from "lucide-react";

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
import { createCompany, createPro } from "@/lib/expeditions";
import { cn } from "@/lib/utils";

/* ============================================================
 * Registering for mountaineering — a company, or a person.
 *
 * WHAT THIS REPLACES
 *   The old first-run screen wrote a row the moment you tapped
 *   a card:
 *
 *     createCompany({ owner_email, name: "My Expedition Company" })
 *     createPro({ owner_email, full_name: "My Name" })
 *
 *   So an admin's approval queue filled with businesses called
 *   "My Expedition Company", and a provider who tapped the
 *   wrong card had already created something. Nothing is
 *   written here until the last step, and it is written with
 *   the name they actually typed.
 *
 * TWO KINDS, ONE WIZARD
 *   A company operates expeditions; a person is a guide,
 *   porter or high-altitude worker. Different tables, and
 *   different questions after the first — so the choice is
 *   step one and the rest follows from it.
 * ============================================================ */

type Kind = "company" | "individual";

export function ExpeditionRegisterWizard({
  user,
  onDone,
}: {
  user: User;
  onDone: () => void;
}) {
  const [kind, setKind] = React.useState<Kind | "">("");

  const [name, setName] = React.useState("");
  const [city, setCity] = React.useState("");
  const [photo, setPhoto] = React.useState("");
  const [about, setAbout] = React.useState("");

  /* Company only */
  const [established, setEstablished] = React.useState("");
  const [address, setAddress] = React.useState("");

  /* Individual only */
  const [role, setRole] = React.useState("");
  const [homeVillage, setHomeVillage] = React.useState("");

  /* Structured area, alongside the free-text city above.

     COMPANIES ONLY, AND THAT IS DELIBERATE.
     phase72 added location_id to a list of listing tables, and that list says
     'expedition_pros'. The real table is expedition_professionals, so the
     to_regclass guard skipped it silently and the column was never created.
     phase95 adds it. Until that has run in the database, sending location_id
     for an individual would fail the insert and stop a porter registering at
     all — so the picker is shown to companies only, and the individual branch
     is wired once phase95 is confirmed. */
  const area = useAreaSelection("expeditions");

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [done, setDone] = React.useState(false);

  const submit = async () => {
    setSubmitting(true);
    setError("");

    if (kind === "company") {
      const { error: e } = await createCompany({
        ...area.payload,
        owner_email: user.email,
        name: name.trim(),
        city: city.trim() || null,
        address: address.trim() || null,
        logo: photo.trim() || null,
        description: about.trim() || null,
        year_established: Number(established) || null,
      });
      setSubmitting(false);
      if (e) {
        setError(e.message);
        return;
      }
    } else {
      const { error: e } = await createPro({
        owner_email: user.email,
        full_name: name.trim(),
        city: city.trim() || null,
        home_village: homeVillage.trim() || null,
        photo: photo.trim() || null,
        role: role.trim() || null,
        short_bio: about.trim() || null,
      });
      setSubmitting(false);
      if (e) {
        setError(e.message);
        return;
      }
    }

    setDone(true);
  };

  if (done) {
    return (
      <RegisteredNotice
        what={kind === "company" ? "expedition company" : "profile"}
        onContinue={onDone}
      />
    );
  }

  const isCompany = kind === "company";

  const steps: RegisterStep[] = [
    {
      title: "How do you work?",
      hint: "This decides what we ask next — you can change it later.",
      validate: () => (kind ? null : "Please choose one."),
      content: (
        <div className="grid gap-3 sm:grid-cols-2">
          <KindCard
            selected={kind === "company"}
            onSelect={() => setKind("company")}
            icon={Building2}
            title="Expedition company"
            body="You run full expeditions — team, packages, permits and logistics."
          />
          <KindCard
            selected={kind === "individual"}
            onSelect={() => setKind("individual")}
            icon={UserRound}
            title="On the mountain"
            body="You work as a guide, porter, cook or high-altitude worker."
          />
        </div>
      ),
    },
    {
      title: isCompany ? "Your company" : "About you",
      hint: "This is what a climber sees first.",
      validate: () =>
        name.trim()
          ? null
          : isCompany
            ? "Please enter your company name."
            : "Please enter your name.",
      content: (
        <>
          <L label={isCompany ? "Company name" : "Your full name"} required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="auth-input"
              placeholder={isCompany ? "e.g. Baltoro Expeditions" : ""}
              autoFocus
            />
          </L>

          {isCompany ? (
            <>
              <L label="Office city">
                <PlaceInput value={city} onChange={setCity} placeholder="e.g. Skardu" />
              </L>
              {area.picker}
              <L label="Office address">
                <input value={address} onChange={(e) => setAddress(e.target.value)} className="auth-input" />
              </L>
              <L label="Year established">
                <input type="number" value={established} onChange={(e) => setEstablished(e.target.value)} className="auth-input" inputMode="numeric" placeholder="e.g. 2014" />
              </L>
            </>
          ) : (
            <>
              <L label="What do you do?">
                <input value={role} onChange={(e) => setRole(e.target.value)} className="auth-input" placeholder="e.g. High-altitude porter, expedition cook" />
              </L>
              <L label="City you work from">
                <PlaceInput value={city} onChange={setCity} placeholder="e.g. Skardu" />
              </L>
              <L label="Home village">
                <PlaceInput value={homeVillage} onChange={setHomeVillage} placeholder="e.g. Hushe" />
              </L>
            </>
          )}

          <L label={isCompany ? "Company logo" : "Your photo"}>
            <ImageUpload value={photo} onChange={setPhoto} />
          </L>
          <L label={isCompany ? "About the company" : "A short introduction"}>
            <textarea
              rows={3}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              className="auth-input resize-none"
              placeholder={
                isCompany
                  ? "Peaks you operate on, how long you have been running"
                  : "Peaks you have worked on, how many seasons"
              }
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
            heading={isCompany ? "Your company" : "You"}
            rows={
              isCompany
                ? [
                    ["Name", name],
                    ["City", city],
                    ["Address", address],
                    ["Established", established],
                  ]
                : [
                    ["Name", name],
                    ["Role", role],
                    ["City", city],
                    ["Home village", homeVillage],
                  ]
            }
          />
          <p className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-forest">
            The Rego team checks new listings before they go live. You can add
            packages, team members and certificates from your dashboard while
            yours is being reviewed.
          </p>
        </div>
      ),
    },
  ];

  return (
    <RegisterSteps
      heading="Register for mountaineering & expeditions"
      steps={steps}
      submitLabel="Submit for review"
      submitting={submitting}
      error={error}
      onSubmit={submit}
    />
  );
}

function KindCard({
  selected,
  onSelect,
  icon: Icon,
  title,
  body,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: typeof Building2;
  title: string;
  body: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "rounded-2xl border-2 p-4 text-left transition-colors",
        selected
          ? "border-forest-600 bg-forest-50"
          : "border-border bg-white hover:border-forest-600/40 hover:bg-muted/50"
      )}
    >
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-forest text-gold">
        <Icon className="h-5 w-5" />
      </span>
      <span className="mt-3 block font-display text-base font-bold text-forest">
        {title}
      </span>
      <span className="mt-1 block text-sm text-muted-foreground">{body}</span>
    </button>
  );
}

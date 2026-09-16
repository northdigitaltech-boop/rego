"use client";

import * as React from "react";

import { toTitleCase } from "@/lib/text-case";

/* ============================================================
 * A text input that tidies a name when the person leaves it.
 *
 * ON BLUR, NOT ON EVERY KEYSTROKE.
 *   Transforming as someone types fights them: they press "P",
 *   the field says "P", they press "I" and it becomes "Pi". The
 *   cursor jumps, capitals they meant get undone mid-word, and on
 *   a phone the autocorrect bar flickers. Waiting until they
 *   leave the field means the change happens once, visibly, after
 *   they have finished the thought.
 *
 * IT IS A SUGGESTION, NOT A LOCK.
 *   Whatever it produces stays editable. Someone who comes back
 *   and types "PIA" in a field it just changed keeps "PIA" —
 *   because by then the text has mixed case and toTitleCase
 *   leaves it alone. The rule defends itself.
 *
 * Drop-in for <input>: every normal prop still works.
 * ============================================================ */

type NameInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
> & {
  value: string;
  onChange: (value: string) => void;
};

export function NameInput({ value, onChange, onBlur, ...rest }: NameInputProps) {
  return (
    <input
      {...rest}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={(e) => {
        const tidied = toTitleCase(e.target.value);
        /* Only fire when it actually differs — an onChange that sets the
           same string still marks a form dirty, and a form that says
           "unsaved changes" after you tabbed through it is a small lie. */
        if (tidied !== value) onChange(tidied);
        onBlur?.(e);
      }}
    />
  );
}

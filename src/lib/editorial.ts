import { aboutContent } from "@/lib/about-content";
import { siteConfig, companyRegistration } from "@/lib/site";

/* ============================================================
 * Editorial standards — the E-E-A-T layer.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS A PAGE AND NOT A META TAG
 *
 * "Experience, Expertise, Authoritativeness, Trust" is not something a site
 * declares in markup. It is something a reader can check:
 *
 *   • who wrote this
 *   • what they actually know about the place
 *   • how it was verified
 *   • what happens when it turns out to be wrong
 *
 * Rego has a genuine answer to the second one, which most travel sites do
 * not: the founder is from Hardass in Roundu district. That is first-hand
 * knowledge of the region the site sells, and it is worth stating plainly
 * rather than dressing up as "local experts".
 *
 * Everything below must stay TRUE. The moment this page describes a process
 * Rego does not actually follow, it stops being a trust signal and becomes a
 * liability.
 * ---------------------------------------------------------------------------
 */

export const EDITORIAL_LAST_UPDATED = "24 August 2026";

export interface EditorialSection {
  heading: string;
  paragraphs: string[];
}

export const editorialPolicy: {
  title: string;
  summary: string;
  sections: EditorialSection[];
} = {
  title: "How Rego writes and checks travel information",
  summary:
    "Who writes the travel answers on Rego, how they are verified, how often they are reviewed, and what happens when something is wrong.",

  sections: [
    {
      heading: "Who writes this",
      paragraphs: [
        `Travel information on Rego is written and reviewed by the Rego team. Rego was founded by ${aboutContent.founder.name}, ${aboutContent.founder.background.toLowerCase()}, who is from ${aboutContent.founder.hometown}.`,
        "That matters for a specific reason: most travel content about Gilgit-Baltistan is written by people who have visited, or by people who have not. Roads close, jeep tracks change, and a valley that is two hours away on a map can be a full day's drive over a pass that is shut for six months. Local knowledge is the difference between an answer that helps and one that strands someone.",
        "Where an answer depends on something we cannot verify ourselves — a government regulation, a published fare, a permit rule — we cite the source rather than assert it.",
      ],
    },
    {
      heading: "How answers are checked before publishing",
      paragraphs: [
        "Nothing publishes automatically. Every answer is written as a draft and published by a person as a separate, deliberate action.",
        "Before an answer can go live, the system checks it for the failures that make travel content untrustworthy: unsourced prices, distances and durations; unverifiable superlatives such as “best” or “largest”; absolute claims like “always” or “guaranteed”; and time-sensitive information with no expiry date.",
        "Some of those are warnings an editor can overrule with a reason. Others cannot be overruled at all — an answer about something that changes over time is refused publication unless it carries both a verification date and an expiry date.",
      ],
    },
    {
      heading: "Information that goes out of date",
      paragraphs: [
        "Road conditions, prices, transport schedules, permit rules and weather warnings all change. We treat these as time-sensitive and handle them differently from stable information.",
        "A time-sensitive answer records when it was last verified and when it expires. Once it expires it stops being shown as current and returns to the team for review. If it has not been re-checked recently, the page says so rather than presenting it as fact.",
        `Live road conditions are not written by hand at all. They come from ${siteConfig.name}'s road updates system, which is updated by people travelling those roads. An answer about a road links to that system rather than repeating a status that would be wrong within days.`,
      ],
    },
    {
      heading: "What we will not publish",
      paragraphs: [
        "We do not invent prices, distances, travel times, road conditions or availability. If we do not know, the page does not say.",
        "We do not call a provider “the best” or “top-rated” unless that ranking comes from genuine published reviews, and we say what the ranking is based on.",
        "“Verified” on Rego means we have checked a provider's registration and contact details. It is not a rating of service quality, and we do not present it as one.",
        "We do not publish counts that flatter the marketplace. If very few providers are listed in an area, we describe what is available rather than quoting a number that reads as emptiness or goes stale within the hour.",
      ],
    },
    {
      heading: "Corrections",
      paragraphs: [
        `If something on Rego is wrong — a price, a distance, a road status, a provider detail — tell us at ${siteConfig.contactEmail} or ${siteConfig.contactPhoneDisplay}. We would rather correct it than defend it.`,
        "Corrections to travel information are made directly on the page and the verification date is updated. Where a correction changes the substance of an answer, the change is recorded in our internal audit log.",
      ],
    },
    {
      heading: "Who Rego is",
      paragraphs: [
        `${companyRegistration.legalName} is registered with the ${companyRegistration.regulatorFull}, incorporated on ${companyRegistration.incorporatedOn} under Corporate Unique Identification Number ${companyRegistration.cuin}. You can verify that on the SECP portal — the registration is a public record and you do not have to take our word for it.`,
        "Rego earns money from the marketplace, not from the travel information. Answers are not sold, and a provider cannot pay to be described as better than they are. Where a listing is promoted, it is labelled.",
      ],
    },
  ],
};

/** Short line for the bottom of pages carrying travel answers. */
export const EDITORIAL_BYLINE =
  "Written and reviewed by the Rego team in Gilgit-Baltistan.";

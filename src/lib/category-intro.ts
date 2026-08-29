/* ============================================================
 * Written copy for the category pages.
 *
 * WHY THIS FILE EXISTS
 *   /categories/hotels, /tours and /guides are card grids with a
 *   heading and nothing else. To a search engine a page like
 *   that is a list of names — there is no writing on it to
 *   match a question against, and no reason to rank it above a
 *   page that answers the question. Every competitor ranking
 *   for "hotels in Gilgit Baltistan" has several hundred words
 *   on the page. These have none.
 *
 * THE {{ }} RULE — the important part of this file
 *   Anything containing {{ }} is a blank waiting to be filled,
 *   and is NEVER RENDERED. Half-written sentences and reminders
 *   can be left here safely; they cannot reach the live site by
 *   accident. Fill in the blank, delete the braces, and that
 *   paragraph starts appearing.
 *
 *   This is deliberate. The facts worth writing here — real
 *   rates, which months a road is open, how long a transfer
 *   takes — are the ones no competitor has, and also the ones
 *   that must not be invented. A number guessed here is a
 *   traveller stranded at Deosai. So the blanks stay blank
 *   until someone who knows fills them, and the page ships
 *   with only what is true in the meantime.
 *
 * HOW TO FILL ONE IN
 *   Find a paragraph with {{ }}, replace the whole braced part
 *   with the real detail, and remove the braces. Nothing else
 *   to do — the page picks it up on its next revalidation.
 * ============================================================ */

export interface CategoryIntro {
  /** Shown above the copy. Not the page's h1 — that is the category name. */
  heading: string;
  /** Paragraphs, in order. Any containing {{ }} is skipped. */
  paragraphs: string[];
  /** Questions worth answering on the page. Same {{ }} rule applies. */
  faqs?: { q: string; a: string }[];
}

/* ------------------------------------------------------------------ */

const INTROS: Record<string, CategoryIntro> = {
  /* ---------------------------------------------------------------- */
  hotels: {
    heading: "About staying in Gilgit-Baltistan",
    paragraphs: [
      "Accommodation across Gilgit-Baltistan ranges from serviced hotels in Skardu and Gilgit town to family-run guesthouses in the valleys, and the difference between them is larger than the price suggests. A hotel on the main road will have reliable power and hot water; a guesthouse two hours up a side valley may have neither, and may be the better stay anyway. Every property listed here is run by the people who own it, and you book with them directly.",

      "Booking on Rego does not add a commission to the room rate. You send a request, the property confirms it, and you settle with them the way you would if you had phoned. What Rego adds is that the request is written down, the confirmation arrives in your inbox, and both sides have the same record of what was agreed — which is worth more than it sounds when you are arranging a room in a valley with intermittent signal.",

      "Before you book anywhere in the region, check three things with the property: whether the road to it is open in the month you are travelling, whether they have power at night, and whether the rate includes meals. In much of Gilgit-Baltistan the answer to the third is yes, and travellers who assume otherwise end up paying twice.",

      "Peak season for most of Gilgit-Baltistan runs {{which months — and say what changes outside them: are rates lower, are properties closed, is the road the limit rather than the hotel?}}",

      "Rates on this page are set by each property. As a rough guide, {{a realistic range for a mid-range double in Skardu, and how that compares to Hunza — only if you are confident in the numbers}}",
    ],
    faqs: [
      {
        q: "Do I pay Rego or the hotel?",
        a: "The hotel. Rego passes your request to the property and confirms it back to you; payment is between you and them, on their terms.",
      },
      {
        q: "Is my booking confirmed straight away?",
        a: "Yes. You receive a confirmation email as soon as you book, and the property receives the same details at the same time.",
      },
      {
        q: "What if I need to cancel?",
        a: "Cancellation terms are the property's own, so ask them before you book. Rego's booking and cancellation policies cover what Rego itself does, and are linked in the footer of every page.",
      },
      {
        q: "How far in advance should I book for the summer season?",
        a: "{{your own experience — weeks? months? does it differ for Skardu vs Hunza vs Fairy Meadows?}}",
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  tours: {
    heading: "About tour packages in Gilgit-Baltistan",
    paragraphs: [
      "A tour package in Gilgit-Baltistan usually covers transport, accommodation and a driver or guide for a fixed number of days, leaving you to arrange only your travel to the starting point. For a first visit this is generally the easier way to travel: the distances are long, the roads are not always where the map says they are, and a local operator who has driven the route this month knows things a route planner does not.",

      "The operators listed here are based in the region and run the trips themselves rather than reselling someone else's. When you book, your request goes to the operator directly and they confirm it to you. Read what each package includes before you compare prices — two trips of the same length and the same headline figure can differ by whether meals, permits and entry fees are counted in.",

      "Ask any operator, before you commit: how many people will be in the vehicle, what happens if the road closes, and whether the itinerary has a spare day in it. Weather changes plans in Gilgit-Baltistan more often than anything else, and the operators worth booking will tell you that before you ask.",

      "Most packages start from {{which towns — Skardu, Gilgit, Islamabad? and does that change the price much?}}",

      "A typical trip runs {{how many days for a standard Skardu circuit, and for Hunza — what do most travellers actually book?}}",

      "On permits: {{which areas need one, who arranges it, and how long it takes — only if you are sure, since this changes}}",
    ],
    faqs: [
      {
        q: "Is the price per person or for the whole group?",
        a: "Each package says which on its own page. Check before comparing two, because the same number can mean either.",
      },
      {
        q: "Can a package be changed once booked?",
        a: "That is between you and the operator. Most will adjust an itinerary if you ask early; few can once the trip has started.",
      },
      {
        q: "What is not usually included?",
        a: "{{what do travellers most often assume is included and find is not — meals, entry fees, tips, the flight?}}",
      },
    ],
  },

  /* ---------------------------------------------------------------- */
  guides: {
    heading: "About hiring a guide in Gilgit-Baltistan",
    paragraphs: [
      "A guide is worth hiring for two different reasons, and it helps to know which one you are hiring for. On a trek or a high-altitude route, a guide is a safety decision — someone who knows the ground, reads the weather, and turns the group around when it needs turning around. On a valley or cultural trip, a guide is the difference between looking at a place and understanding it: who lives there, what the buildings were for, why the fields are laid out that way.",

      "The guides listed here work in the region and are booked directly. Rates are usually quoted per day. Confirm what the day covers before you start — whether it includes the guide's own transport, food and accommodation is the most common misunderstanding, and it is easier settled beforehand than at the end of a trek.",

      "For anything at altitude, ask about the specific route rather than about experience in general. Gilgit-Baltistan is large and a guide who knows one valley well may not know the next one at all; the good ones will say so.",

      "Day rates on this page are set by each guide. Broadly, {{what does a valley day cost versus a trekking day, and what does a multi-day expedition change?}}",

      "Language: {{which languages do guides here commonly speak — English, Urdu, Balti, Burushaski, Shina? worth saying, travellers ask}}",

      "For trekking specifically, {{is there a certification or registration travellers should ask about? if so, name it precisely; if not, leave this blank}}",
    ],
    faqs: [
      {
        q: "How is a guide paid?",
        a: "Directly, on terms you agree with them. Rego confirms the booking and puts the details in writing for both of you; the money does not pass through Rego.",
      },
      {
        q: "Do I need a guide, or can I walk the trails alone?",
        a: "{{honest answer for the popular routes — which are fine alone, which are not, and whether any require a guide by rule}}",
      },
      {
        q: "How far ahead should a guide be booked in summer?",
        a: "{{your own experience — the good ones are presumably taken early, but say how early}}",
      },
    ],
  },
};

/* ------------------------------------------------------------------ */

/** True when a string still has a blank in it. */
const isUnfilled = (s: string) => s.includes("{{") || s.includes("}}");

/**
 * What survives the filter. faqs is a plain array rather than an optional
 * one — the caller is rendering, and having to check for undefined on
 * something this function always supplies is friction for no gain.
 */
export interface PublishedIntro extends CategoryIntro {
  faqs: { q: string; a: string }[];
}

/**
 * The publishable part of a category's copy, or null when there is none.
 *
 * Filtering happens here rather than in the component so that there is one
 * place where the {{ }} rule is enforced, and so a caller cannot forget it.
 */
export function getCategoryIntro(slug: string): PublishedIntro | null {
  const intro = INTROS[slug];
  if (!intro) return null;

  const paragraphs = intro.paragraphs.filter((p) => !isUnfilled(p));
  const faqs = (intro.faqs ?? []).filter(
    (f) => !isUnfilled(f.q) && !isUnfilled(f.a)
  );

  /* Nothing usable left. Better to render no section at all than a heading
     with one sentence under it. */
  if (paragraphs.length === 0) return null;

  return { heading: intro.heading, paragraphs, faqs };
}

/** How much of each category's copy is still waiting on someone. Used by tests. */
export function introCompleteness(slug: string) {
  const intro = INTROS[slug];
  if (!intro) return null;
  const all = [
    ...intro.paragraphs,
    ...(intro.faqs ?? []).flatMap((f) => [f.q, f.a]),
  ];
  return { total: all.length, unfilled: all.filter(isUnfilled).length };
}

/** Every category that has copy written for it, filled or not. */
export const CATEGORIES_WITH_INTRO = Object.keys(INTROS);

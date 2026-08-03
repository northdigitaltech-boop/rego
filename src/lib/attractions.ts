/* ============================================================
 * Tourist attractions shown on each destination page.
 *
 * Stored as a JSONB array on `destinations.attractions`
 * (see supabase/phase65-destination-attractions.sql).
 * ============================================================ */

export interface Attraction {
  /** e.g. "Attabad Lake" */
  name: string;
  /** Short badge, e.g. "Lake" — free text, the list below is just a helper. */
  type: string;
  /** One line of description. */
  blurb: string;
  /** Optional photo. Falls back to the destination cover when empty. */
  image: string;
}

export const ATTRACTION_TYPES = [
  "Lake",
  "Fort",
  "Viewpoint",
  "Valley",
  "Glacier",
  "Waterfall",
  "Desert",
  "Pass",
  "Trek",
  "Heritage",
  "Mountain",
  "Park",
  "Bridge",
] as const;

/** Accepts whatever came back from the database and returns a safe array. */
export function parseAttractions(value: unknown): Attraction[] {
  const raw =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value);
          } catch {
            return [];
          }
        })()
      : value;

  if (!Array.isArray(raw)) return [];

  return raw
    .map((a): Attraction => {
      const o = (a ?? {}) as Record<string, unknown>;
      return {
        name: typeof o.name === "string" ? o.name : "",
        type: typeof o.type === "string" ? o.type : "",
        blurb: typeof o.blurb === "string" ? o.blurb : "",
        image: typeof o.image === "string" ? o.image : "",
      };
    })
    .filter((a) => a.name.trim().length > 0);
}

/* ------------------------------------------------------------
 * Suggested spots, by destination slug.
 *
 * These are the places travellers actually search for in each valley,
 * ordered by demand. The admin can load them with one click and then
 * edit the wording or add photos.
 * ------------------------------------------------------------ */

type Preset = Omit<Attraction, "image">;

export const SUGGESTED_ATTRACTIONS: Record<string, Preset[]> = {
  skardu: [
    { name: "Shangrila / Lower Kachura Lake", type: "Lake", blurb: "The red-roof resort lake — the most photographed spot in Gilgit-Baltistan." },
    { name: "Upper Kachura Lake", type: "Lake", blurb: "Deep turquoise water, boating, and far quieter than its neighbour." },
    { name: "Sarfaranga Cold Desert", type: "Desert", blurb: "One of the highest cold deserts on earth, and home of the jeep rally." },
    { name: "Satpara Lake", type: "Lake", blurb: "Reservoir views on the road up to Deosai." },
    { name: "Kharpocho Fort", type: "Fort", blurb: "Hilltop fort looking straight down the Indus and over the whole town." },
    { name: "Katpana Desert", type: "Desert", blurb: "Sand dunes sitting directly beneath snow peaks." },
    { name: "Basho Valley", type: "Valley", blurb: "Pine forest, waterfalls and the best camping near Skardu." },
    { name: "Manthokha Waterfall", type: "Waterfall", blurb: "A 180-foot fall in Kharmang — the classic day trip." },
  ],
  hunza: [
    { name: "Baltit Fort", type: "Fort", blurb: "A 700-year-old fort above Karimabad — the face of Hunza." },
    { name: "Attabad Lake", type: "Lake", blurb: "Bright blue lake formed by the 2010 landslide. Boating and jet skis." },
    { name: "Passu Cones", type: "Mountain", blurb: "The cathedral-shaped peaks every traveller stops to photograph." },
    { name: "Eagle's Nest (Duikar)", type: "Viewpoint", blurb: "The best sunrise and sunset viewpoint in the region." },
    { name: "Altit Fort", type: "Heritage", blurb: "Older than Baltit, with a restored royal garden." },
    { name: "Hussaini Suspension Bridge", type: "Bridge", blurb: "The famously nerve-wracking rope bridge over the Hunza river." },
    { name: "Khunjerab Pass", type: "Pass", blurb: "The world's highest paved border crossing at 4,693m." },
    { name: "Borith Lake", type: "Lake", blurb: "A quiet migratory-bird lake tucked behind Passu." },
    { name: "Passu & Batura Glacier", type: "Glacier", blurb: "Two of the most accessible glacier walks in Pakistan." },
    { name: "Rakaposhi View Point", type: "Viewpoint", blurb: "Roadside cafés facing a 7,788m peak." },
  ],
  nagar: [
    { name: "Hopper Valley & Glacier", type: "Glacier", blurb: "A dramatic bowl valley wrapped around a black glacier." },
    { name: "Rakaposhi Base Camp", type: "Trek", blurb: "The most achievable base-camp trek in GB, starting from Minapin." },
    { name: "Rush Lake", type: "Trek", blurb: "One of the highest alpine lakes in the world." },
    { name: "Nagar Fort", type: "Heritage", blurb: "The old seat of the Nagar rulers." },
  ],
  gilgit: [
    { name: "Naltar Valley & Lakes", type: "Valley", blurb: "Blue, green and pink lakes up a jeep track — plus GB's ski slope." },
    { name: "Kargah Buddha", type: "Heritage", blurb: "A 7th-century Buddha carved into the cliff face." },
    { name: "Three Mountains Junction", type: "Viewpoint", blurb: "Where the Karakoram, Himalaya and Hindukush ranges meet." },
    { name: "Chinar Bagh", type: "Park", blurb: "Riverside gardens in the middle of town." },
    { name: "Danyore Suspension Bridge", type: "Bridge", blurb: "Old wooden bridge with ancient rock inscriptions nearby." },
  ],
  ghizer: [
    { name: "Phander Lake", type: "Lake", blurb: "Trout fishing and the valley people call mini Switzerland." },
    { name: "Shandur Pass", type: "Pass", blurb: "The world's highest polo ground — the July festival is the draw." },
    { name: "Khalti Lake", type: "Lake", blurb: "Freezes solid in winter, right beside the road." },
    { name: "Handrap Lake", type: "Trek", blurb: "A short trek beyond Phander for those who want the quiet version." },
    { name: "Yasin Valley", type: "Valley", blurb: "Green terraces and old villages well off the tourist trail." },
  ],
  astore: [
    { name: "Rama Lake & Meadows", type: "Lake", blurb: "Pine forest and meadows with Nanga Parbat behind them." },
    { name: "Rupal Valley", type: "Valley", blurb: "Faces the Rupal Face — the highest mountain wall on earth." },
    { name: "Minimarg", type: "Valley", blurb: "A permit area near the line of control, and worth the paperwork." },
    { name: "Tarishing", type: "Trek", blurb: "Trailhead for the Rupal base camp walk." },
    { name: "Chilam", type: "Park", blurb: "The southern gateway into Deosai." },
  ],
  diamer: [
    { name: "Fairy Meadows", type: "Viewpoint", blurb: "The classic Nanga Parbat campsite and viewpoint." },
    { name: "Nanga Parbat Base Camp", type: "Trek", blurb: "A day trek from Fairy Meadows via Beyal Camp." },
    { name: "Babusar Top", type: "Pass", blurb: "A 4,173m pass that only opens in summer." },
    { name: "Raikot Bridge", type: "Bridge", blurb: "Where the famous Fairy Meadows jeep track begins." },
  ],
  "fairy-meadows": [
    { name: "Fairy Meadows Camp", type: "Viewpoint", blurb: "Wooden huts and tents on a meadow facing Nanga Parbat." },
    { name: "Beyal Camp", type: "Trek", blurb: "An hour further up, and a much closer view of the mountain." },
    { name: "Nanga Parbat Base Camp", type: "Trek", blurb: "The full day walk to the foot of the world's ninth-highest peak." },
    { name: "Tato Village", type: "Valley", blurb: "The last road point before the walk in." },
    { name: "Raikot Bridge", type: "Bridge", blurb: "Start of the jeep track up from the Karakoram Highway." },
  ],
  shigar: [
    { name: "Shigar Fort (Fong Khar)", type: "Fort", blurb: "A restored palace that now works as a heritage hotel." },
    { name: "Amburiq Mosque", type: "Heritage", blurb: "A 14th-century carved wooden mosque." },
    { name: "Askole", type: "Trek", blurb: "The last village before K2 and the Baltoro Glacier." },
    { name: "Blind Lake", type: "Lake", blurb: "A hidden lake reached by a short walk." },
  ],
  khaplu: [
    { name: "Khaplu Palace", type: "Fort", blurb: "A beautifully restored royal residence, open to visitors." },
    { name: "Chaqchan Mosque", type: "Heritage", blurb: "Seven centuries old, and carved entirely in wood." },
    { name: "Hushe Valley", type: "Valley", blurb: "Gateway to Masherbrum, K6 and K7." },
    { name: "Thalley Valley", type: "Valley", blurb: "Orchards and homestays away from the main road." },
    { name: "Machulu Viewpoint", type: "Viewpoint", blurb: "Looks straight up the Hushe valley to the peaks." },
  ],
  kharmang: [
    { name: "Manthokha Waterfall", type: "Waterfall", blurb: "The big one — 180 feet, with a park around the base." },
    { name: "Khamosh Waterfall", type: "Waterfall", blurb: "Falls squeezed into a narrow gorge." },
  ],
  deosai: [
    { name: "Sheosar Lake", type: "Lake", blurb: "The Blind Lake, with Nanga Parbat on the horizon behind it." },
    { name: "Bara Pani", type: "Park", blurb: "The classic camping and photo stop in the middle of the plains." },
    { name: "Kala Pani", type: "Park", blurb: "River crossing on the way across the plateau." },
    { name: "Brown Bear Country", type: "Park", blurb: "The park exists to protect the Himalayan brown bear." },
    { name: "Wildflower Season", type: "Park", blurb: "In July the whole plateau turns into a carpet of flowers." },
  ],
  naran: [
    { name: "Saif-ul-Malook Lake", type: "Lake", blurb: "The lake of the fairy legend, under Malika Parbat." },
    { name: "Lulusar Lake", type: "Lake", blurb: "Roadside lake on the way up to Babusar." },
    { name: "Babusar Top", type: "Pass", blurb: "The 4,173m pass that drops you into Gilgit-Baltistan." },
    { name: "Ansoo Lake", type: "Trek", blurb: "A tear-shaped lake, and a demanding day hike." },
    { name: "Shogran & Siri Paye", type: "Viewpoint", blurb: "Green meadows above the valley floor." },
  ],
};

/** Presets for a slug, ready to drop into the editor. */
export function suggestedFor(slug: string): Attraction[] {
  return (SUGGESTED_ATTRACTIONS[slug] ?? []).map((p) => ({ ...p, image: "" }));
}

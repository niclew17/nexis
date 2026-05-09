// All known enum values per resources table column
// Source: SELECT DISTINCT unnest(<column>) FROM resources (213 rows)

export const KNOWN_TOPICS = [
  "Close or Exit a Business",
  "Entrepreneurship Communities",
  "Funding",
  "International Trade",
  "Late Stage Growth",
  "Marketing and Sales",
  "Other",
  "Relocate a Business to Utah",
  "Start a Business",
  "Taxes and Finance",
];

export const KNOWN_INDUSTRIES = [
  "Aerospace and Defense",
  "Agriculture",
  "Arts and Entertainment and Recreation",
  "Consumer Packaged Goods",
  "Financial Services",
  "Hospitality and Food Services",
  "Life Sciences and Healthcare",
  "Manufacturing",
  "Other",
  "Software and Information Technology",
];

export const KNOWN_LOCATIONS = [
  "Beaver", "Box Elder", "Cache", "Carbon", "Daggett", "Davis",
  "Duchesne", "Emery", "Garfield", "Grand", "Iron", "Juab",
  "Kane", "Millard", "Morgan", "Piute", "Rich", "Salt Lake",
  "San Juan", "Sanpete", "Sevier", "Summit", "Tooele", "Uintah",
  "Utah", "Wasatch", "Washington", "Wayne", "Weber",
];

// "Any" is intentionally excluded — it represents "open to all" in the data,
// not a user identity. Including it would let Claude map a generic founder to
// "Any" and inadvertently filter the pool down to only Any-tagged resources.
export const KNOWN_COMMUNITIES = [
  "Multicultural",
  "New American",
  "Rural",
  "Student",
  "Veteran",
  "Women",
];

// City-to-county mapping for voice input normalization (Claude handles most;
// these are the most common Utah cities to nudge it in the right direction).
export const CITY_TO_COUNTY: Record<string, string> = {
  "Salt Lake City": "Salt Lake",
  "Provo": "Utah",
  "Orem": "Utah",
  "Lehi": "Utah",
  "American Fork": "Utah",
  "Ogden": "Weber",
  "St. George": "Washington",
  "Saint George": "Washington",
  "Logan": "Cache",
  "Cedar City": "Iron",
  "Moab": "Grand",
  "Park City": "Summit",
  "Vernal": "Uintah",
  "Price": "Carbon",
  "Richfield": "Sevier",
};

// ── Question definitions ──────────────────────────────────────────────────────

export interface IntakeQuestion {
  index: number;
  text: string;
  column: "topics" | "industries" | "locations" | "communities" | null; // null = free-form (Q5)
}

export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  {
    index: 0,
    text: "What kind of help does your business need right now? For example — raising funding or loans, starting a business, growing into late stage, marketing and sales, taxes and finance, international trade, or connecting with entrepreneur communities.",
    column: "topics",
  },
  {
    index: 1,
    text: "What industry is your business in? For example — software and IT, manufacturing, agriculture, hospitality and food services, life sciences and healthcare, financial services, aerospace and defense, consumer packaged goods, or arts and entertainment.",
    column: "industries",
  },
  {
    index: 2,
    text: "Where in Utah are you based or looking for support? You can name a city, county, or region — like Salt Lake City, Utah County, Cache Valley, or southern Utah.",
    column: "locations",
  },
  {
    index: 3,
    text: "Do any of these describe you or your founding team? Veteran, woman-owned, rural, student, multicultural, or new American. You can name one, a few, or skip if none apply.",
    column: "communities",
  },
  {
    index: 4,
    text: "Tell me more about your specific business and exactly what you need help with right now. Be as specific as you like — describe your product or service, your current stage, and your biggest challenge.",
    column: null,
  },
];

// Returns the allowed enum values for a given column — used to build the Claude tool schema
export function getAllowedValuesForColumn(
  column: "topics" | "industries" | "locations" | "communities"
): string[] {
  switch (column) {
    case "topics":      return KNOWN_TOPICS;
    case "industries":  return KNOWN_INDUSTRIES;
    case "locations":   return KNOWN_LOCATIONS;
    case "communities": return KNOWN_COMMUNITIES;
  }
}

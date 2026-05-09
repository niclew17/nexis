// Stage / size / section unions reflect normalized values produced by
// scripts/geocode-startups.ts after CSV cleanup. Empty string = unknown.
export type StartupStage =
  | "Pre-Seed"
  | "Seed"
  | "Series A"
  | "Series B+"
  | "Series D+"
  | "";

export type StartupEmployees =
  | "1"
  | "2-10"
  | "11-50"
  | "51-200"
  | "201-500"
  | "200+"
  | "";

export type StartupSection =
  | "B2B Software"
  | "FinTech"
  | "Security"
  | "Bio/Medical Tech"
  | "Energy"
  | "Consumer"
  | "Marketplaces"
  | "";

export interface Startup {
  // Core MVP fields
  slug: string;            // derived from linkedin_url company name; used for Phase 2 profile routing
  linkedin_url: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  description: string;
  website: string;
  domain: string;          // extracted from website, used for clearbit logo
  logo_url: string;        // https://logo.clearbit.com/{domain} or empty
  stage: StartupStage;
  employees: StartupEmployees;
  section: StartupSection;

  // Phase 2 profile fields (optional — already in type for extensibility)
  year_founded?: number;
  hiring?: boolean;
  jobs?: Array<{ title: string; url: string }>;
  photos?: string[];
  claimed_at?: string;
  claimed_by?: string;
}

export interface FilterCriteria {
  stage: string[];
  size: string[];
  section: string[];
}

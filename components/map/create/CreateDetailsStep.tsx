"use client";

import { useMemo, useState } from "react";
import { COLORS } from "@/lib/map/mapConfig";
import { extractEmailDomain } from "@/lib/startups/domainCheck";
import { normalizeDomain, getLinkedInSlug } from "@/lib/startups/normalize";
import type { CreateDetailsPayload } from "@/hooks/useStartupCreate";

interface CreateDetailsStepProps {
  email: string;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (details: CreateDetailsPayload) => void;
}

const STAGE_OPTIONS = [
  "Pre-Seed",
  "Seed",
  "Series A",
  "Series B+",
  "Series D+",
] as const;

const EMPLOYEES_OPTIONS = [
  "1",
  "2-10",
  "11-50",
  "51-200",
  "201-500",
  "200+",
] as const;

const SECTION_OPTIONS = [
  "B2B Software",
  "FinTech",
  "Security",
  "Bio/Medical Tech",
  "Energy",
  "Consumer",
  "Marketplaces",
] as const;

export function CreateDetailsStep({
  email,
  isSubmitting,
  error,
  onSubmit,
}: CreateDetailsStepProps) {
  const emailDomain = useMemo(() => extractEmailDomain(email) ?? "", [email]);

  const [name, setName] = useState("");
  const [website, setWebsite] = useState(emailDomain ? `https://${emailDomain}` : "");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [stage, setStage] = useState<string>("");
  const [employees, setEmployees] = useState<string>("");
  const [section, setSection] = useState<string>("");
  const [yearFounded, setYearFounded] = useState<string>("");
  const [hiring, setHiring] = useState(false);

  const websiteDomain = useMemo(() => normalizeDomain(website), [website]);
  const websiteMismatch =
    !!website.trim() && !!emailDomain && websiteDomain !== emailDomain;
  const linkedinSlug = useMemo(() => getLinkedInSlug(linkedinUrl), [linkedinUrl]);
  const linkedinInvalid = !!linkedinUrl.trim() && !linkedinSlug;

  const canSubmit =
    !!name.trim() &&
    !!website.trim() &&
    !websiteMismatch &&
    !!linkedinUrl.trim() &&
    !linkedinInvalid &&
    !!address.trim() &&
    !!description.trim() &&
    !!stage &&
    !!employees &&
    !!section &&
    !isSubmitting;

  const currentYear = new Date().getFullYear();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!canSubmit) return;
        const yf = yearFounded.trim() ? Number.parseInt(yearFounded, 10) : null;
        onSubmit({
          name,
          website,
          linkedin_url: linkedinUrl,
          address,
          description,
          stage,
          employees,
          section,
          year_founded: Number.isInteger(yf) ? yf : null,
          hiring,
        });
      }}
      style={{ display: "flex", flexDirection: "column", gap: "16px" }}
    >
      <div>
        <h1
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "2rem",
            color: COLORS.text,
            margin: 0,
            letterSpacing: "-0.01em",
            lineHeight: 1.15,
          }}
        >
          Tell us about your company
        </h1>
        <p
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.9375rem",
            color: COLORS.textMuted,
            margin: "12px 0 0",
            lineHeight: 1.6,
          }}
        >
          One pass, then we&apos;ll drop a pin on the map.
        </p>
      </div>

      <Field label="Company name" htmlFor="create-name" required>
        <input
          id="create-name"
          type="text"
          autoFocus
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Robotics"
          style={inputStyle}
        />
      </Field>

      <Field
        label="Website"
        htmlFor="create-website"
        required
        hint={
          websiteMismatch
            ? `Website domain must be ${emailDomain}. Saw ${websiteDomain || "(empty)"}.`
            : undefined
        }
        hintIsError={websiteMismatch}
      >
        <input
          id="create-website"
          type="url"
          required
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://acme.com"
          style={inputStyle}
        />
      </Field>

      <Field
        label="LinkedIn URL"
        htmlFor="create-linkedin"
        required
        hint={
          linkedinInvalid
            ? "Use the company URL: https://linkedin.com/company/<handle>"
            : undefined
        }
        hintIsError={linkedinInvalid}
      >
        <input
          id="create-linkedin"
          type="url"
          required
          value={linkedinUrl}
          onChange={(e) => setLinkedinUrl(e.target.value)}
          placeholder="https://linkedin.com/company/acme"
          style={inputStyle}
        />
      </Field>

      <Field label="Street address" htmlFor="create-address" required>
        <textarea
          id="create-address"
          required
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="123 Main St, Salt Lake City, UT 84101"
          rows={2}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </Field>

      <Field
        label="Description"
        htmlFor="create-description"
        required
        hint={`${description.length}/1500`}
      >
        <textarea
          id="create-description"
          required
          maxLength={1500}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does your company do?"
          rows={4}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <Field label="Stage" htmlFor="create-stage" required>
          <select
            id="create-stage"
            required
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            style={selectStyle}
          >
            <option value="">Select…</option>
            {STAGE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Employees" htmlFor="create-employees" required>
          <select
            id="create-employees"
            required
            value={employees}
            onChange={(e) => setEmployees(e.target.value)}
            style={selectStyle}
          >
            <option value="">Select…</option>
            {EMPLOYEES_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Industry" htmlFor="create-section" required>
        <select
          id="create-section"
          required
          value={section}
          onChange={(e) => setSection(e.target.value)}
          style={selectStyle}
        >
          <option value="">Select…</option>
          {SECTION_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </Field>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <Field label="Year founded" htmlFor="create-year">
          <input
            id="create-year"
            type="number"
            min={1800}
            max={currentYear + 1}
            value={yearFounded}
            onChange={(e) => setYearFounded(e.target.value)}
            placeholder={`${currentYear}`}
            style={inputStyle}
          />
        </Field>

        <Field label="Currently hiring" htmlFor="create-hiring">
          <label
            htmlFor="create-hiring"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 12px",
              border: `1px solid ${COLORS.border}`,
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "0.9375rem",
              color: COLORS.text,
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              id="create-hiring"
              type="checkbox"
              checked={hiring}
              onChange={(e) => setHiring(e.target.checked)}
              style={{ accentColor: COLORS.accent }}
            />
            <span>{hiring ? "Yes — hiring" : "No"}</span>
          </label>
        </Field>
      </div>

      {error && (
        <p
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.8125rem",
            color: "#ef4444",
            margin: 0,
          }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        style={{
          marginTop: "8px",
          padding: "12px 16px",
          border: `1px solid ${COLORS.accent}`,
          background: "transparent",
          color: COLORS.accent,
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.875rem",
          letterSpacing: "0.05em",
          cursor: canSubmit ? "pointer" : "not-allowed",
          opacity: canSubmit ? 1 : 0.5,
          transition: "background 0.2s ease-out, color 0.2s ease-out",
        }}
        onMouseEnter={(e) => {
          if (!canSubmit) return;
          (e.currentTarget as HTMLElement).style.background = COLORS.accent;
          (e.currentTarget as HTMLElement).style.color = "black";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = COLORS.accent;
        }}
      >
        {isSubmitting ? "Submitting..." : "Submit listing →"}
      </button>
    </form>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
  hintIsError?: boolean;
}

function Field({ label, htmlFor, children, required, hint, hintIsError }: FieldProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <label
        htmlFor={htmlFor}
        style={{
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.6875rem",
          color: COLORS.textMuted,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        {label}
        {required ? "" : "  (optional)"}
      </label>
      {children}
      {hint && (
        <p
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.75rem",
            color: hintIsError ? "#ef4444" : COLORS.textDim,
            margin: 0,
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "transparent",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  fontFamily: "ui-sans-serif, system-ui, -apple-system",
  fontSize: "0.9375rem",
  padding: "10px 12px",
  outline: "none",
  width: "100%",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none",
  cursor: "pointer",
};

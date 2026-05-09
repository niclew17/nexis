"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Startup,
  StartupStage,
  StartupEmployees,
  StartupSection,
  EditableStartupFields,
} from "@/lib/map/types";
import { COLORS } from "@/lib/map/mapConfig";
import { AddressField } from "./AddressField";

const STAGE_OPTIONS: StartupStage[] = [
  "",
  "Pre-Seed",
  "Seed",
  "Series A",
  "Series B+",
  "Series D+",
];

const EMPLOYEES_OPTIONS: StartupEmployees[] = [
  "",
  "1",
  "2-10",
  "11-50",
  "51-200",
  "201-500",
  "200+",
];

const SECTION_OPTIONS: StartupSection[] = [
  "",
  "B2B Software",
  "FinTech",
  "Security",
  "Bio/Medical Tech",
  "Energy",
  "Consumer",
  "Marketplaces",
];

interface EditPanelProps {
  startup: Startup;
  onCancel: () => void;
  onSaved: (updated: Startup) => void;
}

interface FormState {
  name: string;
  description: string;
  website: string;
  address: string;
  logo_url: string;
  stage: StartupStage;
  employees: StartupEmployees;
  section: StartupSection;
  hiring: boolean;
  year_founded: string; // text in the input, parsed on submit
  jobs: Array<{ title: string; url: string }>;
}

function initialFormState(s: Startup): FormState {
  return {
    name: s.name ?? "",
    description: s.description ?? "",
    website: s.website ?? "",
    address: s.address ?? "",
    logo_url: s.logo_url ?? "",
    stage: s.stage ?? "",
    employees: s.employees ?? "",
    section: s.section ?? "",
    hiring: !!s.hiring,
    year_founded: s.year_founded ? String(s.year_founded) : "",
    jobs: s.jobs ? s.jobs.map((j) => ({ ...j })) : [],
  };
}

function buildPatch(form: FormState, original: Startup): EditableStartupFields {
  const patch: EditableStartupFields = {};
  if (form.name !== (original.name ?? "")) patch.name = form.name;
  if (form.description !== (original.description ?? "")) patch.description = form.description;
  if (form.website !== (original.website ?? "")) patch.website = form.website;
  if (form.address !== (original.address ?? "")) patch.address = form.address;
  if (form.logo_url !== (original.logo_url ?? "")) patch.logo_url = form.logo_url;
  if (form.stage !== (original.stage ?? "")) patch.stage = form.stage;
  if (form.employees !== (original.employees ?? "")) patch.employees = form.employees;
  if (form.section !== (original.section ?? "")) patch.section = form.section;
  if (form.hiring !== !!original.hiring) patch.hiring = form.hiring;

  const newYear = form.year_founded.trim() === "" ? undefined : Number(form.year_founded);
  if (newYear !== original.year_founded) {
    patch.year_founded = newYear;
  }

  const originalJobsJson = JSON.stringify(original.jobs ?? []);
  const newJobsJson = JSON.stringify(form.jobs.filter((j) => j.title.trim() && j.url.trim()));
  if (originalJobsJson !== newJobsJson) {
    patch.jobs = form.jobs.filter((j) => j.title.trim() && j.url.trim());
  }

  return patch;
}

const labelStyle: React.CSSProperties = {
  fontFamily: "ui-sans-serif, system-ui, -apple-system",
  fontSize: "0.6875rem",
  color: COLORS.textMuted,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const inputStyle: React.CSSProperties = {
  background: "transparent",
  border: `1px solid ${COLORS.border}`,
  color: COLORS.text,
  fontFamily: "ui-sans-serif, system-ui, -apple-system",
  fontSize: "0.875rem",
  padding: "8px 10px",
  outline: "none",
};

export function EditPanel({ startup, onCancel, onSaved }: EditPanelProps) {
  const [form, setForm] = useState<FormState>(() => initialFormState(startup));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const updateJob = (index: number, key: "title" | "url", value: string) => {
    setForm((f) => {
      const next = f.jobs.map((j, i) => (i === index ? { ...j, [key]: value } : j));
      return { ...f, jobs: next };
    });
  };

  const addJob = () => {
    if (form.jobs.length >= 10) return;
    setForm((f) => ({ ...f, jobs: [...f.jobs, { title: "", url: "" }] }));
  };

  const removeJob = (index: number) => {
    setForm((f) => ({ ...f, jobs: f.jobs.filter((_, i) => i !== index) }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const patch = buildPatch(form, startup);
    if (Object.keys(patch).length === 0) {
      onCancel();
      return;
    }

    setIsSaving(true);
    const res = await fetch("/api/startups/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: startup.slug, patch }),
    });
    setIsSaving(false);

    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      startup?: Startup;
    };
    if (!res.ok || !json.startup) {
      setError(json.error ?? "Save failed.");
      return;
    }
    onSaved(json.startup);
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    onCancel();
  };

  return (
    <form
      onSubmit={handleSave}
      style={{
        padding: "20px 24px",
        borderTop: `1px solid ${COLORS.border}`,
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      <p
        style={{
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.6875rem",
          color: COLORS.textMuted,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          margin: 0,
        }}
      >
        Edit listing
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label htmlFor="edit-name" style={labelStyle}>Name</label>
        <input
          id="edit-name"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label htmlFor="edit-description" style={labelStyle}>Description</label>
        <textarea
          id="edit-description"
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label htmlFor="edit-website" style={labelStyle}>Website</label>
        <input
          id="edit-website"
          value={form.website}
          onChange={(e) => update("website", e.target.value)}
          style={inputStyle}
          placeholder="https://example.com"
        />
      </div>

      <AddressField
        value={form.address}
        originalValue={startup.address ?? ""}
        onChange={(v) => update("address", v)}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label htmlFor="edit-logo" style={labelStyle}>Logo URL</label>
        <input
          id="edit-logo"
          value={form.logo_url}
          onChange={(e) => update("logo_url", e.target.value)}
          style={inputStyle}
          placeholder="https://..."
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label htmlFor="edit-stage" style={labelStyle}>Stage</label>
          <select
            id="edit-stage"
            value={form.stage}
            onChange={(e) => update("stage", e.target.value as StartupStage)}
            style={inputStyle}
          >
            {STAGE_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v || "—"}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label htmlFor="edit-employees" style={labelStyle}>Employees</label>
          <select
            id="edit-employees"
            value={form.employees}
            onChange={(e) => update("employees", e.target.value as StartupEmployees)}
            style={inputStyle}
          >
            {EMPLOYEES_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v || "—"}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label htmlFor="edit-section" style={labelStyle}>Section</label>
          <select
            id="edit-section"
            value={form.section}
            onChange={(e) => update("section", e.target.value as StartupSection)}
            style={inputStyle}
          >
            {SECTION_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {v || "—"}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label htmlFor="edit-year" style={labelStyle}>Year founded</label>
          <input
            id="edit-year"
            value={form.year_founded}
            onChange={(e) => update("year_founded", e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric"
            style={inputStyle}
            placeholder="2020"
          />
        </div>
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.875rem",
          color: COLORS.text,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={form.hiring}
          onChange={(e) => update("hiring", e.target.checked)}
        />
        Currently hiring
      </label>

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={labelStyle}>Open roles</label>
          <button
            type="button"
            onClick={addJob}
            disabled={form.jobs.length >= 10}
            style={{
              background: "none",
              border: "none",
              color: form.jobs.length >= 10 ? COLORS.textDim : COLORS.accent,
              fontFamily: "ui-sans-serif, system-ui, -apple-system",
              fontSize: "0.75rem",
              cursor: form.jobs.length >= 10 ? "not-allowed" : "pointer",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            + add role
          </button>
        </div>
        {form.jobs.map((job, i) => (
          <div key={i} style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <input
              value={job.title}
              onChange={(e) => updateJob(i, "title", e.target.value)}
              placeholder="Title"
              maxLength={80}
              style={{ ...inputStyle, flex: 1, minWidth: 0 }}
            />
            <input
              value={job.url}
              onChange={(e) => updateJob(i, "url", e.target.value)}
              placeholder="https://..."
              maxLength={300}
              style={{ ...inputStyle, flex: 1.4, minWidth: 0 }}
            />
            <button
              type="button"
              onClick={() => removeJob(i)}
              aria-label="Remove role"
              style={{
                background: "none",
                border: "none",
                color: COLORS.textMuted,
                cursor: "pointer",
                fontSize: "1rem",
                padding: "0 4px",
              }}
            >
              ×
            </button>
          </div>
        ))}
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

      <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
        <button
          type="submit"
          disabled={isSaving}
          style={{
            flex: 1,
            padding: "10px 16px",
            border: `1px solid ${COLORS.accent}`,
            background: "transparent",
            color: COLORS.accent,
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.875rem",
            letterSpacing: "0.05em",
            cursor: isSaving ? "not-allowed" : "pointer",
            opacity: isSaving ? 0.6 : 1,
          }}
        >
          {isSaving ? "Saving..." : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          style={{
            padding: "10px 16px",
            border: `1px solid ${COLORS.border}`,
            background: "transparent",
            color: COLORS.textMuted,
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.875rem",
            letterSpacing: "0.05em",
            cursor: isSaving ? "not-allowed" : "pointer",
          }}
        >
          Cancel
        </button>
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        style={{
          background: "none",
          border: "none",
          color: COLORS.textMuted,
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.75rem",
          cursor: "pointer",
          padding: 0,
          textDecoration: "underline",
          alignSelf: "flex-start",
        }}
      >
        sign out
      </button>
    </form>
  );
}

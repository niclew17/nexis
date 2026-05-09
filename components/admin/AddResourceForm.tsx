"use client";

import { useState } from "react";
import { COLORS } from "@/lib/map/mapConfig";
import {
  KNOWN_TOPICS,
  KNOWN_INDUSTRIES,
  KNOWN_LOCATIONS,
  KNOWN_COMMUNITIES,
} from "@/lib/intake/filterConstants";

interface AddResourceFormProps {
  token: string;
  onSuccess: (id: string, externalId: number) => void;
}

export function AddResourceForm({ token, onSuccess }: AddResourceFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [link, setLink] = useState("");
  const [email, setEmail] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [communities, setCommunities] = useState<string[]>([]);
  const [industries, setIndustries] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    !!title.trim() &&
    !!description.trim() &&
    topics.length > 0 &&
    !isSubmitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/resources/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          title,
          description,
          link,
          email,
          communities,
          industries,
          locations,
          topics,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `Request failed (${res.status})`);
        return;
      }
      onSuccess(data.id, data.external_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "16px" }}
    >
      <div>
        <p
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.9375rem",
            color: COLORS.textMuted,
            margin: "12px 0 0",
            lineHeight: 1.6,
          }}
        >
          New rows are immediately matchable by the four-question intake. Tag
          conservatively — every checked enum widens the candidate pool.
        </p>
      </div>

      <Field label="Title" htmlFor="admin-title" required>
        <input
          id="admin-title"
          type="text"
          autoFocus
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Utah Veteran Entrepreneur Program"
          style={inputStyle}
        />
      </Field>

      <Field
        label="Description"
        htmlFor="admin-description"
        required
        hint={`${description.length}/4000`}
      >
        <textarea
          id="admin-description"
          required
          maxLength={4000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does the program do, who is it for, and how do founders engage with it?"
          rows={6}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </Field>

      <Field label="Link" htmlFor="admin-link">
        <input
          id="admin-link"
          type="url"
          maxLength={500}
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://business.utah.gov/program"
          style={inputStyle}
        />
      </Field>

      <Field label="Email" htmlFor="admin-email">
        <input
          id="admin-email"
          type="email"
          maxLength={200}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="contact@program.org"
          style={inputStyle}
        />
      </Field>

      <CheckboxGrid
        label="Topics"
        required
        values={KNOWN_TOPICS}
        selected={topics}
        onChange={setTopics}
        columns={2}
      />

      <CheckboxGrid
        label="Industries"
        values={KNOWN_INDUSTRIES}
        selected={industries}
        onChange={setIndustries}
        columns={2}
      />

      <CheckboxGrid
        label="Locations"
        values={KNOWN_LOCATIONS}
        selected={locations}
        onChange={setLocations}
        columns={4}
      />

      <CheckboxGrid
        label="Communities"
        values={KNOWN_COMMUNITIES}
        selected={communities}
        onChange={setCommunities}
        columns={2}
      />

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
        {isSubmitting ? "Submitting..." : "Add resource →"}
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

interface CheckboxGridProps {
  label: string;
  required?: boolean;
  values: readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  columns?: number;
}

function CheckboxGrid({
  label,
  required,
  values,
  selected,
  onChange,
  columns = 2,
}: CheckboxGridProps) {
  return (
    <Field
      label={label}
      htmlFor={`grid-${label}`}
      required={required}
      hint={`${selected.length} selected`}
    >
      <div
        id={`grid-${label}`}
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gap: "6px",
        }}
      >
        {values.map((v) => {
          const checked = selected.includes(v);
          return (
            <label
              key={v}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 8px",
                border: `1px solid ${COLORS.border}`,
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                fontSize: "0.8125rem",
                color: COLORS.text,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...selected, v]
                      : selected.filter((x) => x !== v)
                  )
                }
                style={{ accentColor: COLORS.accent }}
              />
              <span>{v}</span>
            </label>
          );
        })}
      </div>
    </Field>
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

"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Startup } from "@/lib/map/types";
import { COLORS } from "@/lib/map/mapConfig";
import {
  PHOTO_BUCKET,
  MAX_PHOTOS_PER_STARTUP,
  MAX_PHOTO_BYTES,
  ALLOWED_PHOTO_MIME_TYPES,
} from "@/lib/startups/photoConfig";

interface PhotoManagerProps {
  startup: Startup;
  // Live update — fires after each photo upload/delete/reorder. Distinct from
  // the EditPanel's onSaved which would also exit edit mode.
  onUpdate: (updated: Startup) => void;
}

const labelStyle: React.CSSProperties = {
  fontFamily: "ui-sans-serif, system-ui, -apple-system",
  fontSize: "0.6875rem",
  color: COLORS.textMuted,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
};

const THUMB_SIZE = 84;

export function PhotoManager({ startup, onUpdate }: PhotoManagerProps) {
  const [error, setError] = useState<string | null>(null);
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Stabilize `photos` against identity changes from `?? []` per render.
  const photos = useMemo(() => startup.photos ?? [], [startup.photos]);

  // getPublicUrl is a synchronous string-build; cache the URLs once per render.
  const supabase = useMemo(() => createClient(), []);
  const photoUrls = useMemo(
    () =>
      photos.map((p) => supabase.storage.from(PHOTO_BUCKET).getPublicUrl(p).data.publicUrl),
    [photos, supabase]
  );

  const remaining = MAX_PHOTOS_PER_STARTUP - photos.length;
  const canUpload = remaining > 0 && !isUploading;

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (inputRef.current) inputRef.current.value = "";
    if (files.length === 0) return;
    if (files.length > remaining) {
      setError(
        `Only ${remaining} photo slot${remaining === 1 ? "" : "s"} left. Remove one to add more.`
      );
      return;
    }
    for (const f of files) {
      if (!ALLOWED_PHOTO_MIME_TYPES.has(f.type)) {
        setError(`Unsupported file type: ${f.type || "(unknown)"}.`);
        return;
      }
      if (f.size > MAX_PHOTO_BYTES) {
        setError(`File too large (max 5 MB): ${f.name}.`);
        return;
      }
    }

    setError(null);
    setIsUploading(true);
    const form = new FormData();
    form.append("slug", startup.slug);
    for (const f of files) form.append("file", f);

    const res = await fetch("/api/startups/photos/upload", {
      method: "POST",
      body: form,
    });
    setIsUploading(false);
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      startup?: Startup;
      error?: string;
    };
    if (!res.ok || !json.startup) {
      setError(json.error ?? "Upload failed.");
      return;
    }
    onUpdate(json.startup);
  };

  const handleDelete = async (index: number) => {
    const path = photos[index];
    if (!path) return;
    setBusyIndex(index);
    setError(null);
    const res = await fetch("/api/startups/photos/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: startup.slug, path }),
    });
    setBusyIndex(null);
    const json = (await res.json().catch(() => ({}))) as {
      startup?: Startup;
      error?: string;
    };
    if (!res.ok || !json.startup) {
      setError(json.error ?? "Delete failed.");
      return;
    }
    onUpdate(json.startup);
  };

  const handleReorder = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= photos.length) return;
    const next = [...photos];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    setBusyIndex(index);
    setError(null);
    const res = await fetch("/api/startups/photos/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: startup.slug, paths: next }),
    });
    setBusyIndex(null);
    const json = (await res.json().catch(() => ({}))) as {
      startup?: Startup;
      error?: string;
    };
    if (!res.ok || !json.startup) {
      setError(json.error ?? "Reorder failed.");
      return;
    }
    onUpdate(json.startup);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <label style={labelStyle}>Photos</label>

      {photos.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          {photos.map((path, i) => {
            const isBusy = busyIndex === i;
            const isFirst = i === 0;
            const isLast = i === photos.length - 1;
            return (
              <div
                key={path}
                style={{
                  position: "relative",
                  width: THUMB_SIZE,
                  height: THUMB_SIZE,
                  borderRadius: 4,
                  overflow: "hidden",
                  border: `1px solid ${COLORS.border}`,
                  backgroundColor: COLORS.surface,
                  flexShrink: 0,
                  opacity: isBusy ? 0.4 : 1,
                  transition: "opacity 0.15s ease-out",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoUrls[i]}
                  alt={`Photo ${i + 1}`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.opacity = "0.2";
                  }}
                />

                {/* Reorder + delete overlay */}
                <div
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    display: "flex",
                    gap: 4,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleDelete(i)}
                    disabled={isBusy}
                    aria-label={`Remove photo ${i + 1}`}
                    style={overlayBtnStyle(isBusy)}
                  >
                    ×
                  </button>
                </div>
                <div
                  style={{
                    position: "absolute",
                    bottom: 4,
                    left: 4,
                    display: "flex",
                    gap: 4,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleReorder(i, -1)}
                    disabled={isBusy || isFirst}
                    aria-label="Move earlier"
                    style={overlayBtnStyle(isBusy || isFirst)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReorder(i, 1)}
                    disabled={isBusy || isLast}
                    aria-label="Move later"
                    style={overlayBtnStyle(isBusy || isLast)}
                  >
                    ↓
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <label
        htmlFor="photo-input"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          border: `1px dashed ${canUpload ? COLORS.borderAccent : COLORS.border}`,
          color: canUpload ? COLORS.textMuted : COLORS.textDim,
          cursor: canUpload ? "pointer" : "not-allowed",
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.8125rem",
          textAlign: "center",
        }}
      >
        {isUploading
          ? "Uploading..."
          : !canUpload
          ? `Maximum ${MAX_PHOTOS_PER_STARTUP} photos. Remove one to add another.`
          : `Drop or choose photos · ${remaining} left · 5 MB max each`}
      </label>
      <input
        id="photo-input"
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFiles}
        disabled={!canUpload}
        style={{ display: "none" }}
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
    </div>
  );
}

function overlayBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    width: 22,
    height: 22,
    borderRadius: 4,
    border: "none",
    background: "rgba(0,0,0,0.7)",
    color: disabled ? COLORS.textDim : "white",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: "0.875rem",
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
  };
}

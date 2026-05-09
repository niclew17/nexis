"use client";

import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { COLORS } from "@/lib/map/mapConfig";
import { PHOTO_BUCKET } from "@/lib/startups/photoConfig";

interface HeroGalleryProps {
  photos: string[];
  onOpen: (index: number) => void;
}

// Hero photo (16:9) plus a horizontal thumbnail strip. Tapping any image
// opens the lightbox via onOpen(index). Renders nothing if photos is empty
// — the parent decides what to show as a fallback (logo treatment, usually).
export function HeroGallery({ photos, onOpen }: HeroGalleryProps) {
  const supabase = useMemo(() => createClient(), []);
  const urls = useMemo(
    () =>
      photos.map(
        (p) => supabase.storage.from(PHOTO_BUCKET).getPublicUrl(p).data.publicUrl
      ),
    [photos, supabase]
  );

  if (photos.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <button
        type="button"
        onClick={() => onOpen(0)}
        style={{
          width: "100%",
          aspectRatio: "16 / 9",
          padding: 0,
          border: "none",
          background: COLORS.surface,
          cursor: "pointer",
          overflow: "hidden",
          display: "block",
        }}
        aria-label="Open photo gallery"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={urls[0]}
          alt="Featured"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.opacity = "0.2";
          }}
        />
      </button>

      {photos.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: "6px",
            overflowX: "auto",
            paddingBottom: "4px",
          }}
        >
          {photos.map((path, i) => (
            <button
              key={path}
              type="button"
              onClick={() => onOpen(i)}
              style={{
                width: 64,
                height: 48,
                padding: 0,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.surface,
                cursor: "pointer",
                flexShrink: 0,
                overflow: "hidden",
              }}
              aria-label={`Open photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urls[i]}
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
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

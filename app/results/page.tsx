"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAnonymousAuth } from "@/hooks/useAnonymousAuth";
import { ResultsNarrative } from "@/components/results/ResultsNarrative";
import { ResourceCard } from "@/components/results/ResourceCard";

interface StoredResult {
  id: string;
  title: string;
  matchReason: string;
  topics: string[];
  link: string;
}

interface StoredResults {
  narrative: string;
  results: StoredResult[];
}

export default function ResultsPage() {
  const { isAnonymous } = useAnonymousAuth();
  const [data, setData] = useState<StoredResults | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("nexis-results");
    if (raw) {
      try {
        setData(JSON.parse(raw));
      } catch {
        // malformed data — treat as missing
      }
    }
    setLoaded(true);
  }, []);

  if (!loaded) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          backgroundColor: "black",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      />
    );
  }

  if (!data) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          backgroundColor: "black",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          color: "white",
          gap: "24px",
        }}
      >
        <p
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "1.25rem",
          }}
        >
          No results found.
        </p>
        <Link
          href="/"
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.875rem",
            color: "white",
            textDecoration: "underline",
          }}
        >
          ← Start over
        </Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", backgroundColor: "black", color: "white" }}>
      {/* Sticky header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          padding: "20px 24px",
          backgroundColor: "black",
          borderBottom: "1px solid #111",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 10,
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontSize: "clamp(2.25rem, 5vw, 3rem)",
            color: "white",
            textDecoration: "none",
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          Utah&apos;s Nexis
        </Link>
        {isAnonymous && (
          <div
            style={{
              position: "absolute",
              right: "24px",
              top: "50%",
              transform: "translateY(-50%)",
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <a
              href="/auth/login"
              style={{
                color: "#888",
                fontSize: "0.875rem",
                textDecoration: "none",
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
              }}
            >
              Log in
            </a>
            <a
              href="/auth/sign-up?reason=save"
              style={{
                color: "white",
                fontSize: "0.875rem",
                border: "1px solid white",
                padding: "6px 16px",
                textDecoration: "none",
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
              }}
            >
              Save results
            </a>
          </div>
        )}
      </header>

      {/* Body */}
      <main
        style={{
          maxWidth: "680px",
          margin: "0 auto",
          padding: "64px 24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          gap: "16px",
        }}
      >
        <ResultsNarrative narrative={data.narrative} />
        {data.results.map((result) => (
          <ResourceCard
            key={result.id}
            title={result.title}
            matchReason={result.matchReason}
            topics={result.topics}
            link={result.link}
          />
        ))}
        {isAnonymous && (
          <div style={{ textAlign: "center", marginTop: "32px" }}>
            <a
              href="/auth/sign-up?reason=save"
              style={{
                fontFamily: "ui-sans-serif, system-ui, -apple-system",
                fontSize: "0.875rem",
                color: "white",
                textDecoration: "underline",
              }}
            >
              Save your results →
            </a>
          </div>
        )}
      </main>
    </div>
  );
}

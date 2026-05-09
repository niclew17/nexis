"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

interface FeatureCardProps {
  href: string;
  label: string;
  heading: string;
  description: string;
}

function FeatureCard({ href, label, heading, description }: FeatureCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div variants={item} style={{ flex: 1, minWidth: 0 }}>
      <Link
        href={href}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          padding: "32px",
          border: `1px solid ${hovered ? "#2a5e49" : "#1a1a1a"}`,
          textDecoration: "none",
          color: "white",
          cursor: "pointer",
          transition: "border-color 0.25s ease-out",
          height: "100%",
          minHeight: "240px",
        }}
      >
        <span
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.6875rem",
            color: "#555",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
        <h2
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "1.5rem",
            color: "white",
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          {heading}
        </h2>
        <p
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.875rem",
            color: "#666666",
            lineHeight: 1.6,
            margin: 0,
            flex: 1,
          }}
        >
          {description}
        </p>
        <span
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "1rem",
            color: hovered ? "white" : "#2a5e49",
            transition: "color 0.2s ease-out",
            marginTop: "8px",
          }}
        >
          →
        </span>
      </Link>
    </motion.div>
  );
}

function LandingContent() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <main
      style={{
        height: "100dvh",
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "black",
        color: "white",
        padding: "32px",
      }}
    >
      {/* Ambient pulsing rings — pointer-events:none, behind content */}
      <motion.div
        aria-hidden
        style={{
          position: "absolute",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.04)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
        animate={{ scale: [1, 1.08, 1], opacity: [0.04, 0.07, 0.04] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        style={{
          position: "absolute",
          width: "900px",
          height: "900px",
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.04)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
        animate={{ scale: [1.08, 1, 1.08], opacity: [0.05, 0.03, 0.05] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 4 }}
      />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: "880px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* Wordmark */}
        <motion.h1
          variants={item}
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontSize: "clamp(3rem, 8vw, 6rem)",
            color: "white",
            letterSpacing: "-0.02em",
            margin: 0,
            lineHeight: 1,
          }}
        >
          Nexis
        </motion.h1>

        {/* Tagline */}
        <motion.p
          variants={item}
          style={{
            fontFamily: "ui-sans-serif, system-ui, -apple-system",
            fontSize: "0.9375rem",
            color: "#666666",
            marginTop: "16px",
            marginBottom: "64px",
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          Utah&apos;s founder resource navigator
        </motion.p>

        {/* Feature cards */}
        <div
          style={{
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            gap: "16px",
            width: "100%",
          }}
        >
          <FeatureCard
            href="/resources"
            label="Resources"
            heading="Find your match."
            description="Voice-first discovery across 213 Utah state programs, personalized to your business in under two minutes."
          />
          <FeatureCard
            href="/map"
            label="Map"
            heading="Explore the map."
            description="Browse Utah's founder resources by location — see what's available in your county."
          />
        </div>
      </motion.div>
    </main>
  );
}

export default function Home() {
  return <LandingContent />;
}

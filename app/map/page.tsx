import Link from "next/link";

export default function Map() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "black",
        color: "white",
        padding: "32px",
      }}
    >
      <Link href="/" style={{ display: "block", lineHeight: 0, marginBottom: "48px" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Nexis"
          style={{ height: "72px", width: "auto", opacity: 0.9, userSelect: "none" }}
        />
      </Link>

      <h1
        style={{
          fontFamily: "var(--font-instrument-serif)",
          fontSize: "clamp(3rem, 8vw, 5rem)",
          color: "white",
          letterSpacing: "-0.02em",
          margin: 0,
          lineHeight: 1,
        }}
      >
        Map
      </h1>

      <p
        style={{
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.9375rem",
          color: "#666666",
          marginTop: "16px",
          marginBottom: "48px",
          maxWidth: "440px",
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        Explore Utah&apos;s founder resources by location — coming soon.
      </p>

      <Link
        href="/"
        style={{
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.8125rem",
          color: "#2a5e49",
          textDecoration: "none",
          letterSpacing: "0.05em",
          padding: "12px 24px",
          border: "1px solid #1a1a1a",
          transition: "border-color 0.2s ease-out",
        }}
      >
        ← Back to home
      </Link>
    </main>
  );
}

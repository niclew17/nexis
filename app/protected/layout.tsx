import Link from "next/link";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col gap-20 items-center">
        <nav
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "20px 24px",
            borderBottom: "1px solid #111",
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
            Nexis
          </Link>
        </nav>
        <div className="flex-1 flex flex-col gap-20 max-w-5xl p-5 w-full">
          {children}
        </div>
      </div>
    </main>
  );
}

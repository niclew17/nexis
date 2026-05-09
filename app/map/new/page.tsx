import { Suspense } from "react";
import type { Metadata } from "next";
import { CreateStartupClient } from "@/components/map/create/CreateStartupClient";

export const metadata: Metadata = {
  title: "Add your startup — Nexis",
};

// Suspense boundary required by Next 16's Cache Components — the client tree
// uses framer-motion + useSearchParams-adjacent hooks that would otherwise
// fail static prerender. The fallback is a black surface matching CreateLayout.
export default function MapNewPage() {
  return (
    <Suspense
      fallback={<div style={{ minHeight: "100dvh", backgroundColor: "black" }} />}
    >
      <CreateStartupClient />
    </Suspense>
  );
}

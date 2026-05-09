import { Suspense } from "react";
import { notFound } from "next/navigation";
import { verifyAdminToken } from "@/lib/admin/token";
import { CreateLayout } from "@/components/map/create/CreateLayout";
import { AddResourceClient } from "./AddResourceClient";

// Suspense boundary lets Next 16 prerender the shell immediately and resolve
// the dynamic `params` token inside the boundary. Without it, Cache Components
// flags `await params` as a blocking-route error.
async function GuardedForm({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!verifyAdminToken(token)) notFound();
  return <AddResourceClient token={token} />;
}

export default function AddResourcePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <CreateLayout>
      <h1
        style={{
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "2rem",
          letterSpacing: "-0.01em",
          margin: "0 0 24px",
        }}
      >
        Add a resource
      </h1>
      <Suspense fallback={null}>
        <GuardedForm params={params} />
      </Suspense>
    </CreateLayout>
  );
}

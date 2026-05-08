import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function SavedContent() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  if (data.claims.is_anonymous) {
    redirect("/auth/sign-up?reason=save");
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Your Saved Resources</h1>
      <p className="text-muted-foreground">
        Your personalized resource matches will appear here.
      </p>
    </div>
  );
}

export default function SavedPage() {
  return (
    <Suspense fallback={<div className="h-64" />}>
      <SavedContent />
    </Suspense>
  );
}

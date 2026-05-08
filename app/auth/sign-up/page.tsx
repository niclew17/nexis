import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SignUpForm } from "@/components/sign-up-form";
import { ConvertAccountForm } from "@/components/auth/ConvertAccountForm";

async function SignUpContent({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  await connection();
  const { reason } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const isAnonymous = data?.claims?.is_anonymous === true;

  if (isAnonymous) {
    return (
      <div>
        <h2 className="text-2xl font-semibold mb-2">
          {reason === "save" ? "Save your results" : "Create an account"}
        </h2>
        <p className="text-muted-foreground text-sm mb-6">
          Enter your email to save your personalized resource matches.
        </p>
        <ConvertAccountForm />
      </div>
    );
  }

  return <SignUpForm />;
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Suspense fallback={<div className="h-64" />}>
          <SignUpContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

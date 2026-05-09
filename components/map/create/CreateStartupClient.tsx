"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { COLORS } from "@/lib/map/mapConfig";
import { useStartupCreate } from "@/hooks/useStartupCreate";
import { extractEmailDomain } from "@/lib/startups/domainCheck";
import { CreateLayout } from "./CreateLayout";
import { CreateAuthStep } from "./CreateAuthStep";
import { CreateOtpStep } from "./CreateOtpStep";
import { CreateDetailsStep } from "./CreateDetailsStep";
import { DuplicateDomainNotice } from "./DuplicateDomainNotice";

export function CreateStartupClient() {
  const router = useRouter();
  const create = useStartupCreate();

  // After a successful create, give the user ~700ms to see the success copy,
  // then redirect with `replace` so the back button doesn't return to a
  // half-completed form.
  useEffect(() => {
    if (create.step !== "created" || !create.createdSlug) return;
    const id = window.setTimeout(() => {
      router.replace(`/map?startup=${encodeURIComponent(create.createdSlug!)}`);
    }, 700);
    return () => window.clearTimeout(id);
  }, [create.step, create.createdSlug, router]);

  const emailDomain = useMemo(
    () => extractEmailDomain(create.email) ?? "",
    [create.email]
  );

  return (
    <CreateLayout>
      <AnimatePresence mode="wait">
        <motion.div
          key={create.step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {create.step === "account" && (
            <CreateAuthStep
              initialEmail={create.email}
              isSubmitting={create.isSubmitting}
              error={create.error}
              onSubmit={create.submitAccount}
            />
          )}
          {create.step === "otp" && (
            <CreateOtpStep
              email={create.email}
              isSubmitting={create.isSubmitting}
              error={create.error}
              resendIn={create.resendIn}
              onSubmit={create.submitOtp}
              onResend={create.resendOtp}
            />
          )}
          {(create.step === "details" || create.step === "submitting") && (
            <CreateDetailsStep
              email={create.email}
              isSubmitting={create.step === "submitting" || create.isSubmitting}
              error={create.error}
              onSubmit={create.submitDetails}
            />
          )}
          {create.step === "created" && (
            <SuccessView slug={create.createdSlug ?? ""} />
          )}
          {create.step === "duplicate" && create.duplicate && (
            <DuplicateDomainNotice
              domain={emailDomain}
              existingSlug={create.duplicate.slug}
              existingName={create.duplicate.name}
              onRetry={create.reset}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </CreateLayout>
  );
}

function SuccessView({ slug }: { slug: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <h1
        style={{
          fontFamily: "var(--font-instrument-serif)",
          fontSize: "2rem",
          color: COLORS.text,
          margin: 0,
          letterSpacing: "-0.01em",
          lineHeight: 1.15,
        }}
      >
        Listing created
      </h1>
      <p
        style={{
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.9375rem",
          color: COLORS.textMuted,
          margin: 0,
          lineHeight: 1.6,
        }}
      >
        Opening your pin on the map…
      </p>
      <p
        style={{
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.75rem",
          color: COLORS.textDim,
          margin: 0,
        }}
      >
        slug: {slug}
      </p>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Startup } from "@/lib/map/types";
import { COLORS } from "@/lib/map/mapConfig";
import { useStartupClaim } from "@/hooks/useStartupClaim";
import { ClaimEmailStep } from "./ClaimEmailStep";
import { ClaimPasswordStep } from "./ClaimPasswordStep";
import { ClaimOtpStep } from "./ClaimOtpStep";
import { ClaimSuccess } from "./ClaimSuccess";

interface ClaimSectionProps {
  startup: Startup;
  onCancel: () => void;
  onEdit: () => void;
  onClaimed: (claim: { claimedBy: string; claimedAt: string }) => void;
}

export function ClaimSection({ startup, onCancel, onEdit, onClaimed }: ClaimSectionProps) {
  const claim = useStartupClaim(startup);

  // Kick off the email step the first time this section mounts. Without this,
  // the section would render the idle button — but the InfoPanel only mounts
  // ClaimSection when the user already pressed "Claim this startup", so we
  // jump straight to the email step.
  useEffect(() => {
    if (claim.step === "idle") claim.start();
  }, [claim]);

  // Notify parent on successful claim so the InfoPanel can refresh the
  // selectedStartup with claimed_by/claimed_at.
  useEffect(() => {
    if (claim.step === "claimed" && claim.claimedBy && claim.claimedAt) {
      onClaimed({ claimedBy: claim.claimedBy, claimedAt: claim.claimedAt });
    }
  }, [claim.step, claim.claimedBy, claim.claimedAt, onClaimed]);

  return (
    <div style={{ padding: "0 24px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
      <p
        style={{
          fontFamily: "ui-sans-serif, system-ui, -apple-system",
          fontSize: "0.6875rem",
          color: COLORS.textMuted,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          margin: 0,
        }}
      >
        Claim {startup.name}
      </p>

      <AnimatePresence mode="wait">
        <motion.div
          key={claim.step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {(claim.step === "idle" || claim.step === "email") && (
            <ClaimEmailStep
              startupDomain={startup.domain ?? ""}
              initialValue={claim.email}
              error={claim.error}
              onSubmit={claim.submitEmail}
              onCancel={onCancel}
            />
          )}
          {claim.step === "password" && (
            <ClaimPasswordStep
              email={claim.email}
              isSubmitting={claim.isSubmitting}
              error={claim.error}
              onSubmit={claim.submitPassword}
              onBack={() => claim.reset()}
            />
          )}
          {(claim.step === "otp" || claim.step === "verifying") && (
            <ClaimOtpStep
              email={claim.email}
              isSubmitting={claim.isSubmitting || claim.step === "verifying"}
              error={claim.error}
              resendIn={claim.resendIn}
              onSubmit={claim.submitOtp}
              onResend={claim.resend}
            />
          )}
          {claim.step === "claimed" && (
            <ClaimSuccess
              startupName={startup.name}
              onEdit={onEdit}
              onClose={onCancel}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  extractEmailDomain,
  matchesStartupDomain,
} from "@/lib/startups/domainCheck";
import type { Startup } from "@/lib/map/types";

export type ClaimStep =
  | "idle"
  | "email"
  | "password"
  | "otp"
  | "verifying"
  | "claimed"
  | "error";

const RESEND_COOLDOWN_MS = 30_000;

interface ClaimState {
  step: ClaimStep;
  email: string;
  password: string;
  error: string | null;
  isSubmitting: boolean;
  resendIn: number;
  claimedBy: string | null;
  claimedAt: string | null;
}

const INITIAL: ClaimState = {
  step: "idle",
  email: "",
  password: "",
  error: null,
  isSubmitting: false,
  resendIn: 0,
  claimedBy: null,
  claimedAt: null,
};

export function useStartupClaim(startup: Startup) {
  const [state, setState] = useState<ClaimState>(INITIAL);
  const resendDeadlineRef = useRef<number>(0);

  const start = useCallback(() => {
    setState({ ...INITIAL, step: "email" });
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL);
  }, []);

  const setError = useCallback((message: string) => {
    setState((s) => ({ ...s, error: message, isSubmitting: false }));
  }, []);

  const submitEmail = useCallback(
    (email: string) => {
      const trimmed = email.trim();
      const emailDomain = extractEmailDomain(trimmed);
      if (!emailDomain) {
        setError("Enter a valid email address.");
        return;
      }
      if (!matchesStartupDomain(emailDomain, startup.domain)) {
        setError(`Email must be at @${startup.domain}.`);
        return;
      }
      setState((s) => ({
        ...s,
        email: trimmed,
        error: null,
        step: "password",
      }));
    },
    [startup.domain, setError]
  );

  const submitPassword = useCallback(
    async (password: string) => {
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
      setState((s) => ({ ...s, password, isSubmitting: true, error: null }));
      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: state.email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/map`,
        },
      });
      if (error) {
        const msg = /already registered/i.test(error.message)
          ? "An account already exists for this email. Log in instead."
          : error.message;
        setState((s) => ({
          ...s,
          isSubmitting: false,
          error: msg,
        }));
        return;
      }
      resendDeadlineRef.current = Date.now() + RESEND_COOLDOWN_MS;
      setState((s) => ({
        ...s,
        isSubmitting: false,
        step: "otp",
        resendIn: Math.ceil(RESEND_COOLDOWN_MS / 1000),
      }));
    },
    [state.email, setError]
  );

  const submitOtp = useCallback(
    async (token: string) => {
      const cleaned = token.replace(/\D/g, "");
      if (cleaned.length !== 6) {
        setError("Enter the 6-digit code from the email.");
        return;
      }
      setState((s) => ({ ...s, isSubmitting: true, error: null, step: "verifying" }));
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: state.email,
        token: cleaned,
        type: "signup",
      });
      if (verifyError) {
        setState((s) => ({
          ...s,
          isSubmitting: false,
          step: "otp",
          error: verifyError.message,
        }));
        return;
      }

      const res = await fetch("/api/startups/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: startup.slug }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        startup?: { claimed_by?: string; claimed_at?: string };
      };
      if (!res.ok) {
        setState((s) => ({
          ...s,
          isSubmitting: false,
          step: "otp",
          error: json.error ?? "Claim failed. Please try again.",
        }));
        return;
      }
      setState((s) => ({
        ...s,
        isSubmitting: false,
        step: "claimed",
        error: null,
        claimedBy: json.startup?.claimed_by ?? null,
        claimedAt: json.startup?.claimed_at ?? null,
      }));
    },
    [state.email, startup.slug, setError]
  );

  const resend = useCallback(async () => {
    if (Date.now() < resendDeadlineRef.current) return;
    setState((s) => ({ ...s, isSubmitting: true, error: null }));
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: state.email,
    });
    if (error) {
      setState((s) => ({ ...s, isSubmitting: false, error: error.message }));
      return;
    }
    resendDeadlineRef.current = Date.now() + RESEND_COOLDOWN_MS;
    setState((s) => ({
      ...s,
      isSubmitting: false,
      resendIn: Math.ceil(RESEND_COOLDOWN_MS / 1000),
    }));
  }, [state.email]);

  // Tick the resendIn countdown once per second whenever > 0.
  useEffect(() => {
    if (state.resendIn <= 0) return;
    const id = window.setInterval(() => {
      setState((s) => ({
        ...s,
        resendIn: Math.max(0, Math.ceil((resendDeadlineRef.current - Date.now()) / 1000)),
      }));
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.resendIn]);

  return {
    ...state,
    start,
    reset,
    submitEmail,
    submitPassword,
    submitOtp,
    resend,
  };
}

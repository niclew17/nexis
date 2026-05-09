"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { extractEmailDomain } from "@/lib/startups/domainCheck";
import { isFreeMailDomain } from "@/lib/startups/freeMailDomains";

export type CreateStep =
  | "account"
  | "otp"
  | "details"
  | "submitting"
  | "created"
  | "duplicate";

const RESEND_COOLDOWN_MS = 30_000;

// Shape of the long form on CreateDetailsStep. The form owns its own field
// state; only this trimmed payload is handed to submitDetails().
export interface CreateDetailsPayload {
  name: string;
  website: string;
  linkedin_url: string;
  address: string;
  description: string;
  stage: string;
  employees: string;
  section: string;
  year_founded?: number | null;
  hiring?: boolean | null;
}

interface CreateState {
  step: CreateStep;
  email: string;
  error: string | null;
  isSubmitting: boolean;
  resendIn: number;
  createdSlug: string | null;
  duplicate: { slug: string; name: string } | null;
}

const INITIAL: CreateState = {
  step: "account",
  email: "",
  error: null,
  isSubmitting: false,
  resendIn: 0,
  createdSlug: null,
  duplicate: null,
};

export function useStartupCreate() {
  const [state, setState] = useState<CreateState>(INITIAL);
  const resendDeadlineRef = useRef<number>(0);

  const reset = useCallback(() => {
    setState(INITIAL);
  }, []);

  const submitAccount = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      const trimmed = email.trim();
      const emailDomain = extractEmailDomain(trimmed);
      if (!emailDomain) {
        setState((s) => ({ ...s, error: "Enter a valid email address." }));
        return;
      }
      if (isFreeMailDomain(emailDomain)) {
        setState((s) => ({
          ...s,
          error: "Free email providers aren't allowed. Use your company email.",
        }));
        return;
      }
      if (password.length < 8) {
        setState((s) => ({
          ...s,
          error: "Password must be at least 8 characters.",
        }));
        return;
      }

      setState((s) => ({
        ...s,
        email: trimmed,
        error: null,
        isSubmitting: true,
      }));

      const supabase = createClient();
      const { error } = await supabase.auth.signUp({
        email: trimmed,
        password,
        options: {
          // emailRedirectTo is the magic-link fallback; the primary path is
          // OTP entry on the next step.
          emailRedirectTo: `${window.location.origin}/auth/confirm?next=/map/new`,
        },
      });

      if (error) {
        const msg = /already registered/i.test(error.message)
          ? "An account already exists for this email. Log in instead."
          : error.message;
        setState((s) => ({ ...s, isSubmitting: false, error: msg }));
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
    []
  );

  const submitOtp = useCallback(
    async (token: string) => {
      const cleaned = token.replace(/\D/g, "");
      if (cleaned.length !== 6) {
        setState((s) => ({
          ...s,
          error: "Enter the 6-digit code from the email.",
        }));
        return;
      }

      setState((s) => ({ ...s, isSubmitting: true, error: null }));
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email: state.email,
        token: cleaned,
        type: "signup",
      });
      if (error) {
        setState((s) => ({
          ...s,
          isSubmitting: false,
          error: error.message,
        }));
        return;
      }

      setState((s) => ({
        ...s,
        isSubmitting: false,
        step: "details",
        error: null,
      }));
    },
    [state.email]
  );

  const resendOtp = useCallback(async () => {
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

  const submitDetails = useCallback(async (details: CreateDetailsPayload) => {
    setState((s) => ({
      ...s,
      step: "submitting",
      isSubmitting: true,
      error: null,
    }));

    const payload = {
      name: details.name.trim(),
      website: details.website.trim(),
      linkedin_url: details.linkedin_url.trim(),
      address: details.address.trim(),
      description: details.description.trim(),
      stage: details.stage,
      employees: details.employees,
      section: details.section,
      year_founded:
        typeof details.year_founded === "number" ? details.year_founded : null,
      hiring: typeof details.hiring === "boolean" ? details.hiring : false,
    };

    const res = await fetch("/api/startups/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      slug?: string;
      error?: string;
      existingSlug?: string;
      existingName?: string;
    };

    if (res.status === 409 && json.existingSlug) {
      setState((s) => ({
        ...s,
        step: "duplicate",
        isSubmitting: false,
        error: null,
        duplicate: {
          slug: json.existingSlug as string,
          name: json.existingName ?? "the existing listing",
        },
      }));
      return;
    }

    if (!res.ok || !json.slug) {
      setState((s) => ({
        ...s,
        step: "details",
        isSubmitting: false,
        error: json.error ?? "Something went wrong. Please try again.",
      }));
      return;
    }

    setState((s) => ({
      ...s,
      step: "created",
      isSubmitting: false,
      error: null,
      createdSlug: json.slug ?? null,
    }));
  }, []);

  // Tick the resendIn countdown once per second whenever > 0.
  useEffect(() => {
    if (state.resendIn <= 0) return;
    const id = window.setInterval(() => {
      setState((s) => ({
        ...s,
        resendIn: Math.max(
          0,
          Math.ceil((resendDeadlineRef.current - Date.now()) / 1000)
        ),
      }));
    }, 1000);
    return () => window.clearInterval(id);
  }, [state.resendIn]);

  return {
    ...state,
    reset,
    submitAccount,
    submitOtp,
    resendOtp,
    submitDetails,
  };
}

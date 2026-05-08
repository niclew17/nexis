"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ConversionState = "idle" | "email_sent" | "error";

export function ConvertAccountForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<ConversionState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${window.location.origin}/auth/confirm?next=/saved` },
    );

    setIsLoading(false);

    if (error) {
      setErrorMsg(error.message);
      setState("error");
    } else {
      setState("email_sent");
    }
  };

  if (state === "email_sent") {
    return (
      <div style={{ textAlign: "center" }}>
        <p>
          Check your email at <strong>{email}</strong> to confirm your account.
        </p>
        <p style={{ fontSize: "0.875rem", color: "#666", marginTop: "8px" }}>
          Your results are saved and will be waiting when you return.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", flexDirection: "column", gap: "16px" }}
    >
      <div>
        <Label htmlFor="save-email">Email address</Label>
        <Input
          id="save-email"
          type="email"
          placeholder="you@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ marginTop: "8px" }}
        />
      </div>
      {errorMsg && (
        <p style={{ fontSize: "0.875rem", color: "#ef4444" }}>{errorMsg}</p>
      )}
      <Button type="submit" disabled={isLoading}>
        {isLoading ? "Saving..." : "Save my results"}
      </Button>
    </form>
  );
}

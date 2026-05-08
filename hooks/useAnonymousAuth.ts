"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAnonymousAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    async function ensureSession() {
      const {
        data: { user: existingUser },
      } = await supabase.auth.getUser();

      if (existingUser) {
        setUser(existingUser);
        setIsReady(true);
        return;
      }

      const { data, error } = await supabase.auth.signInAnonymously();
      if (!error && data.user) {
        setUser(data.user);
      }
      setIsReady(true);
    }

    ensureSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, isReady, isAnonymous: user?.is_anonymous === true };
}

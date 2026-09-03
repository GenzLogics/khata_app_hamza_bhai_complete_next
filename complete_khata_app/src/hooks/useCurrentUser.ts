"use client";

import { useEffect, useState } from "react";
import { authService } from "@/services/auth.service";
import type { User } from "@/types/auth.types";

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(() => authService.getStoredUser());
  const [isLoading, setIsLoading] = useState<boolean>(() => authService.isAuthenticated());

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!authService.isAuthenticated()) {
        if (alive) setIsLoading(false);
        return;
      }

      try {
        const me = await authService.getMe();
        if (!alive) return;
        setUser(me);
        authService.storeUser(me);
      } catch {
        if (!alive) return;
        setUser(authService.getStoredUser());
      } finally {
        if (alive) setIsLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  return { user, isLoading };
}

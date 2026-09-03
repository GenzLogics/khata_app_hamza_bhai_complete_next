"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authService } from "@/services/auth.service";
import type { SignInRequest, SignUpRequest, User } from "@/types/auth.types";
import { extractErrorMessage } from "@/services/api";

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => authService.getStoredUser());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const isAuthenticated = authService.isAuthenticated();

  async function signIn(data: SignInRequest): Promise<{ ok: boolean; error?: string }> {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authService.signIn(data);
      queryClient.clear();
      setUser(res.user);
      return { ok: true };
    } catch (err) {
      const msg = extractErrorMessage(err);
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  }

  async function signUp(data: SignUpRequest): Promise<{ ok: boolean; error?: string }> {
    setIsLoading(true);
    setError(null);
    try {
      await authService.signUp(data);
      queryClient.clear();
      return { ok: true };
    } catch (err) {
      const msg = extractErrorMessage(err);
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  }

  async function signOut() {
    await authService.signOut();
    queryClient.clear();
    setUser(null);
  }

  return { user, isAuthenticated, isLoading, error, signIn, signUp, signOut };
}

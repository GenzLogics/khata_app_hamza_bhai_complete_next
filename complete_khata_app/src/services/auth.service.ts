import Cookies from "js-cookie";
import { apiClient } from "./api";
import type {
  SignInRequest,
  SignInResponse,
  SignUpRequest,
  SignUpResponse,
  User,
} from "@/types/auth.types";

const COOKIE_OPTIONS = { expires: 7, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const };
const USER_STORAGE_KEY = "khata_user";

function canUseStorage() {
  return typeof window !== "undefined";
}

function normalizeUser(raw: unknown): User | null {
  if (!raw || typeof raw !== "object") return null;
  const u = raw as Record<string, unknown>;
  return {
    id: String(u.id || u._id || ""),
    email: String(u.email || ""),
    full_name: String(u.full_name ?? u.fullName ?? u.name ?? ""),
    is_active: (u.is_active as boolean) ?? (u.isActive as boolean) ?? true,
    created_at: String(u.created_at ?? u.createdAt ?? ""),
  };
}

export const authService = {
  storeUser(user: User) {
    if (!canUseStorage()) return;
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  },

  getStoredUser(): User | null {
    if (!canUseStorage()) return null;
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return normalizeUser(parsed);
    } catch {
      return null;
    }
  },

  clearStoredUser() {
    if (!canUseStorage()) return;
    localStorage.removeItem(USER_STORAGE_KEY);
  },

  async signUp(data: SignUpRequest): Promise<SignUpResponse> {
    const res = await apiClient.post<SignUpResponse>("/auth/signup", data);
    return res.data;
  },

  async signIn(data: SignInRequest): Promise<SignInResponse> {
    const res = await apiClient.post<SignInResponse>("/auth/signin", data);
    const { tokens } = res.data;
    Cookies.set("access_token", tokens.access_token, COOKIE_OPTIONS);
    Cookies.set("refresh_token", tokens.refresh_token, COOKIE_OPTIONS);
    authService.storeUser(res.data.user);
    return res.data;
  },

  async getMe(): Promise<User> {
    const res = await apiClient.get<User>("/auth/me");
    return res.data;
  },

  async signOut(): Promise<void> {
    try {
      await apiClient.post("/auth/signout");
    } catch {
      // proceed with local cleanup even if the API call fails
    }
    Cookies.remove("access_token");
    Cookies.remove("refresh_token");
    authService.clearStoredUser();
  },

  getAccessToken(): string | undefined {
    return Cookies.get("access_token");
  },

  isAuthenticated(): boolean {
    return !!Cookies.get("access_token");
  },
};

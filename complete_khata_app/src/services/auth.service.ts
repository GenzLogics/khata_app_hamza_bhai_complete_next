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
      return JSON.parse(raw) as User;
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
    const refreshToken = Cookies.get("refresh_token");
    if (refreshToken) {
      try {
        await apiClient.post("/auth/signout", { refresh_token: refreshToken });
      } catch {
        // proceed with local cleanup even if the API call failsc
      }
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

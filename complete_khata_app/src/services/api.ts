import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import Cookies from "js-cookie";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

// Attach token to every request
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = Cookies.get("access_token");
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function clearSessionAndRedirect() {
  Cookies.remove("access_token");
  Cookies.remove("refresh_token");
  window.location.href = "/login";
}

// Auth endpoints handle their own errors — never intercept their 401s
const AUTH_ENDPOINTS = ["/auth/signin", "/auth/signup", "/auth/signout"];

// On 401: try to refresh the access token once, then retry the original request.
// If refresh fails, clear session and redirect to login.
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    const isAuthEndpoint = AUTH_ENDPOINTS.some((ep) => original.url?.includes(ep));
    if (isAuthEndpoint) return Promise.reject(error);

    if (error.response?.status === 401 && original._retry) {
      clearSessionAndRedirect();
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !original._retry && typeof window !== "undefined") {
      const refreshToken = Cookies.get("refresh_token");
      if (!refreshToken) {
        clearSessionAndRedirect();
        return Promise.reject(error);
      }

      original._retry = true;
      try {
        const { data } = await axios.post<{ access_token: string }>(
          `${API_BASE_URL}/auth/refresh`,
          { refresh_token: refreshToken },
          { headers: { "Content-Type": "application/json" } }
        );
        Cookies.set("access_token", data.access_token, { expires: 7 });
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return apiClient(original);
      } catch {
        clearSessionAndRedirect();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((d: { msg: string; ctx?: { error?: unknown } }) => {
          const raw = typeof d.ctx?.error === "string" ? d.ctx.error : d.msg;
          return raw.replace(/^Value error,\s*/i, "");
        })
        .join("\n");
    }
  }
  return "An unexpected error occurred";
}

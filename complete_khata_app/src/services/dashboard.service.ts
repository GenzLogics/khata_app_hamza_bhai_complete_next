import { apiClient } from "./api";
import type { DashboardCountsResponse, DashboardDailyResponse, DashboardPeriod, DashboardSummaryResponse, DailyBreakdownResponse } from "@/types/dashboard.types";

export const dashboardService = {
  async getCounts(): Promise<DashboardCountsResponse> {
    const res = await apiClient.get<DashboardCountsResponse>("/dashboard/");
    return res.data;
  },

  async getSummary(period?: DashboardPeriod, from_date?: string, to_date?: string): Promise<DashboardSummaryResponse> {
    const params: Record<string, string> = {};
    if (period) params.period = period;
    if (from_date) params.from_date = from_date;
    if (to_date) params.to_date = to_date;
    const res = await apiClient.get<DashboardSummaryResponse>("/dashboard/summary", { params });
    return res.data;
  },

  async getDaily(from_date?: string, to_date?: string): Promise<DashboardDailyResponse> {
    const params: Record<string, string> = {};
    if (from_date) params.from_date = from_date;
    if (to_date) params.to_date = to_date;
    const res = await apiClient.get<DashboardDailyResponse>("/dashboard/daily", { params });
    return res.data;
  },
};

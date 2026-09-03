import { apiClient } from "./api";
import type {
  Investor,
  InvestorCreate,
  InvestorListResponse,
  InvestorSummary,
  InvestorUpdate,
} from "@/types/investor.types";

export const investorsService = {
  async list(params?: { skip?: number; limit?: number; search?: string }): Promise<InvestorListResponse> {
    const res = await apiClient.get<InvestorListResponse>("/investors/", { params });
    return res.data;
  },

  async getSummary(): Promise<InvestorSummary> {
    const res = await apiClient.get<InvestorSummary>("/investors/summary");
    return res.data;
  },

  async getById(id: string): Promise<Investor> {
    const res = await apiClient.get<Investor>(`/investors/${id}`);
    return res.data;
  },

  async create(data: InvestorCreate): Promise<Investor> {
    const res = await apiClient.post<Investor>("/investors/", data);
    return res.data;
  },

  async update(id: string, data: InvestorUpdate): Promise<Investor> {
    const res = await apiClient.put<Investor>(`/investors/${id}`, data);
    return res.data;
  },

  async delete(id: string): Promise<Investor> {
    const res = await apiClient.delete<Investor>(`/investors/${id}`);
    return res.data;
  },
};

import { apiClient } from "./api";
import type { CashSale, CashSaleCreate, CashSaleUpdate, CashSaleListResponse, CashSaleSummary } from "@/types/cash-sale.types";

export const cashSalesService = {
  async list(params?: { from_date?: string; to_date?: string; limit?: number; skip?: number }): Promise<CashSaleListResponse> {
    const res = await apiClient.get<CashSaleListResponse>("/cash-sales/", { params });
    return res.data;
  },

  async getSummary(params?: { from_date?: string; to_date?: string }): Promise<CashSaleSummary> {
    const res = await apiClient.get<CashSaleSummary>("/cash-sales/summary", { params });
    return res.data;
  },

  async getById(id: string): Promise<CashSale> {
    const res = await apiClient.get<CashSale>(`/cash-sales/${id}`);
    return res.data;
  },

  async create(data: CashSaleCreate): Promise<CashSale> {
    const res = await apiClient.post<CashSale>("/cash-sales/", data);
    return res.data;
  },

  async update(id: string, data: CashSaleUpdate): Promise<CashSale> {
    const res = await apiClient.put<CashSale>(`/cash-sales/${id}`, data);
    return res.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/cash-sales/${id}`);
  },
};

import { apiClient } from "./api";
import type {
  BagReturnRequest,
  BagReturnResponse,
  StockDeleteResponse,
  StockListResponse,
} from "@/types/stock.types";

export const stockService = {
  async list(params?: { skip?: number; limit?: number; search?: string }): Promise<StockListResponse> {
    const res = await apiClient.get<StockListResponse>("/stock/", { params });
    return res.data;
  },

  async returnBags(data: BagReturnRequest): Promise<BagReturnResponse> {
    const res = await apiClient.post<BagReturnResponse>("/stock/return-bags", data);
    return res.data;
  },

  // Manual stock create/update/delete calls are intentionally commented out.
  // Stock should move only through invoice flows:
  // - sales invoices deduct stock
  // - purchase invoices add stock
  // async create(data: StockCreate): Promise<StockItem> {
  //   const res = await apiClient.post<StockSuccessResponse>("/stock/", data);
  //   return res.data.stock;
  // },
  //
  // async update(id: string, data: StockUpdate): Promise<StockItem> {
  //   const res = await apiClient.put<StockSuccessResponse>(`/stock/${id}`, data);
  //   return res.data.stock;
  // },
  //
  async delete(id: string): Promise<StockDeleteResponse> {
    const res = await apiClient.delete<StockDeleteResponse>(`/stock/${id}`);
    return res.data;
  },
};

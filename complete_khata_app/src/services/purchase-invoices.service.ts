import { apiClient } from "./api";
import type {
  PaymentRequest,
  PurchaseInvoice,
  PurchaseInvoiceCreate,
  PurchaseInvoiceListResponse,
} from "@/types/invoice.types";

export const purchaseInvoicesService = {
  async list(params?: {
    skip?: number;
    limit?: number;
    vendor_id?: string;
    from_date?: string;
    to_date?: string;
  }): Promise<PurchaseInvoiceListResponse> {
    const res = await apiClient.get<PurchaseInvoiceListResponse>("/purchase-invoices/", { params });
    return res.data;
  },

  async getById(id: string): Promise<PurchaseInvoice> {
    const res = await apiClient.get<PurchaseInvoice>(`/purchase-invoices/${id}`);
    return res.data;
  },

  async create(data: PurchaseInvoiceCreate): Promise<PurchaseInvoice> {
    const res = await apiClient.post<PurchaseInvoice>("/purchase-invoices/", data);
    return res.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/purchase-invoices/${id}`);
  },

  async recordPayment(id: string, data: PaymentRequest): Promise<PurchaseInvoice> {
    const res = await apiClient.post<PurchaseInvoice>(`/purchase-invoices/${id}/payment`, data);
    return res.data;
  },
};

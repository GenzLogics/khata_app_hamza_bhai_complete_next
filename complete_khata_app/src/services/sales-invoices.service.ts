import { apiClient } from "./api";
import type {
  PaymentRequest,
  SalesInvoice,
  SalesInvoiceCreate,
  SalesInvoiceListResponse,
  SalesInvoiceSuccessResponse,
} from "@/types/invoice.types";

export const salesInvoicesService = {
  async list(params?: {
    skip?: number;
    limit?: number;
    customer_id?: string;
    from_date?: string;
    to_date?: string;
  }): Promise<SalesInvoiceListResponse> {
    const res = await apiClient.get<SalesInvoiceListResponse>("/sales-invoices/", { params });
    return res.data;
  },

  async getById(id: string): Promise<SalesInvoice> {
    const res = await apiClient.get<SalesInvoiceSuccessResponse>(`/sales-invoices/${id}`);
    return res.data.invoice;
  },

  async create(data: SalesInvoiceCreate): Promise<SalesInvoice> {
    const res = await apiClient.post<SalesInvoiceSuccessResponse>("/sales-invoices/", data);
    return res.data.invoice;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/sales-invoices/${id}`);
  },

  async recordPayment(id: string, data: PaymentRequest): Promise<SalesInvoice> {
    const res = await apiClient.post<SalesInvoiceSuccessResponse>(`/sales-invoices/${id}/payment`, data);
    return res.data.invoice;
  },
};

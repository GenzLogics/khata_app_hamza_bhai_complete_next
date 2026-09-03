import { apiClient } from "./api";
import type {
  Customer,
  CustomerCreate,
  CustomerCreditResponse,
  CustomerDeleteResponse,
  CustomerListResponse,
  CustomerSuccessResponse,
  CustomerUpdate,
} from "@/types/customer.types";

export const customersService = {
  async list(params?: { skip?: number; limit?: number; search?: string }): Promise<CustomerListResponse> {
    const res = await apiClient.get<CustomerListResponse>("/customers/", { params });
    return res.data;
  },

  async getById(id: string): Promise<Customer> {
    const res = await apiClient.get<CustomerSuccessResponse>(`/customers/${id}`);
    return res.data.customer;
  },

  async create(data: CustomerCreate): Promise<Customer> {
    const res = await apiClient.post<CustomerSuccessResponse>("/customers/", data);
    return res.data.customer;
  },

  async update(id: string, data: CustomerUpdate): Promise<Customer> {
    const res = await apiClient.put<CustomerSuccessResponse>(`/customers/${id}`, data);
    return res.data.customer;
  },

  async getCredit(id: string): Promise<CustomerCreditResponse> {
    const res = await apiClient.get<CustomerCreditResponse>(`/customers/${id}/credit`);
    return res.data;
  },

  async delete(id: string): Promise<CustomerDeleteResponse> {
    const res = await apiClient.delete<CustomerDeleteResponse>(`/customers/${id}`);
    return res.data;
  },
};

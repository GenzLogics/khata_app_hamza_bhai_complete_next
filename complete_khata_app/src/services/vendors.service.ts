import { apiClient } from "./api";
import type {
  Vendor,
  VendorCreate,
  VendorItemCreate,
  VendorItemsResponse,
  VendorListResponse,
  VendorUpdate,
} from "@/types/vendor.types";

export const vendorsService = {
  async list(params?: { skip?: number; limit?: number; search?: string }): Promise<VendorListResponse> {
    const res = await apiClient.get<VendorListResponse>("/vendors/", { params });
    return res.data;
  },

  async getById(id: string): Promise<Vendor> {
    const res = await apiClient.get<Vendor>(`/vendors/${id}`);
    return res.data;
  },

  async getItems(id: string): Promise<VendorItemsResponse> {
    const res = await apiClient.get<VendorItemsResponse>(`/vendors/${id}/items`);
    return res.data;
  },

  async addItem(id: string, data: VendorItemCreate): Promise<VendorItemsResponse> {
    const res = await apiClient.post<VendorItemsResponse>(`/vendors/${id}/items`, data);
    return res.data;
  },

  async create(data: VendorCreate): Promise<Vendor> {
    const res = await apiClient.post<Vendor>("/vendors/", data);
    return res.data;
  },

  async update(id: string, data: VendorUpdate): Promise<Vendor> {
    const res = await apiClient.put<Vendor>(`/vendors/${id}`, data);
    return res.data;
  },

  async deleteVendor(id: string): Promise<void> {
    await apiClient.delete(`/vendors/${id}`);
  },

  async deactivate(id: string): Promise<void> {
    await vendorsService.deleteVendor(id);
  },
};

export interface Vendor {
  id: string;
  owner_id?: string;
  name: string;
  phone?: string;
  current_balance: number;
  debit_amount: number;
  total_amount: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface VendorCreate {
  name: string;
  phone?: string;
}

export interface VendorUpdate {
  name?: string;
  phone?: string;
}

export interface VendorItemCreate {
  item_name: string;
}

export interface VendorListResponse {
  total: number;
  items: Vendor[];
}

export interface VendorItemsResponse {
  items: string[];
}

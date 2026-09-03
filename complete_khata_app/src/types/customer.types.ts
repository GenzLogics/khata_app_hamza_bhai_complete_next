export interface Customer {
  id: string;
  name: string;
  phone?: string;
  is_active: boolean;
  credit_amount: number;
  created_at: string;
  updated_at: string;
}

export interface CustomerCreate {
  name: string;
  phone?: string;
}

export interface CustomerUpdate {
  name?: string;
  phone?: string;
}

export interface CustomerSuccessResponse {
  message: string;
  customer: Customer;
}

export interface CustomerListResponse {
  message: string;
  total: number;
  items: Customer[];
}

export interface CustomerCreditResponse {
  customer_id: string;
  credit_amount: number;
}

export interface CustomerDeleteResponse {
  message: string;
}

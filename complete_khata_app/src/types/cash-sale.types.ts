export interface CashSaleCreate {
  amount: number;
  from_date: string;
  to_date: string;
  notes?: string;
}

export interface CashSaleUpdate {
  amount?: number;
  from_date?: string;
  to_date?: string;
  notes?: string;
}

export interface CashSale {
  id: string;
  owner_id: string;
  amount: number;
  from_date: string;
  to_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CashSaleListResponse {
  total: number;
  items: CashSale[];
}

export interface CashSaleSummary {
  total_count: number;
  total_amount: number;
}

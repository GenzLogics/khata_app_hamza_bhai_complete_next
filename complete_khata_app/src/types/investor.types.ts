export interface Investor {
  id: string;
  owner_id: string;
  investment_amount: number;
  investment_date?: string;
  investor_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvestorCreate {
  investment_amount: number;
  investment_date?: string;
  investor_name?: string;
  notes?: string;
}

export interface InvestorUpdate {
  investment_amount?: number;
  investment_date?: string;
  investor_name?: string | null;
  notes?: string | null;
}

export interface InvestorListResponse {
  total: number;
  items: Investor[];
}

export interface InvestorSummary {
  total_invested: number;
  count: number;
}

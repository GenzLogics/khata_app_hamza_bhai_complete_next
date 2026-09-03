export enum ExpenseHeading {
  MALL_KHATA = "Maal Khata",
  KE_BILL_SHOP = "KE bill shop",
  KE_BILL_GODOWN = "KE bill godown",
  MASJID_KHATA = "Masjid khata",
}

export interface Expense {
  id: string;
  amount: number;
  from_date: string;
  to_date: string;
  heading: string;
  sub_heading: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseCreate {
  amount: number;
  from_date: string;
  to_date: string;
  heading: string;
  sub_heading?: string;
  notes?: string;
}

export interface ExpenseUpdate {
  amount?: number;
  from_date?: string;
  to_date?: string;
  heading?: string;
  sub_heading?: string;
  notes?: string | null;
}

export interface ExpenseListResponse {
  total: number;
  items: Expense[];
}

export interface ExpenseSummary {
  total_amount: number;
}

export interface HeadingOperationResponse {
  updated: number;
}

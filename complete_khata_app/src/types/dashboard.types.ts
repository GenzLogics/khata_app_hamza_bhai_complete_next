export interface DashboardCountsResponse {
  message: string;
  total_customers: number;
  total_vendors: number;
  total_sales_invoices: number;
  total_purchase_invoices: number;
  purchase_balance_due_total: number;
  monthly_expenses_total: number;
  monthly_cash_sales_total: number;
}

export type DashboardPeriod = "1d" | "7d" | "1m" | "3m" | "6m" | "1y";

export interface DashboardSummaryResponse {
  message: string;
  period: DashboardPeriod;
  from_date: string;
  to_date: string;
  total_customers: number;
  total_vendors: number;
  cash_sales_count: number;
  cash_sales_total: number;
  sales_invoices_count: number;
  sales_total: number;
  amount_paid_total: number;
  balance_due_total: number;
  purchase_invoices_count: number;
  purchase_total: number;
  purchase_balance_due_total: number;
  expenses_total: number;
}

export type TransactionType = 
  | "cash_sale"
  | "invoice"
  | "invoice_credit"
  | "payment"
  | "expense"
  | "purchase_invoice"
  | "purchase_payment";

export enum ReportItemType {
  CASH_SALE = "Cash Sale",
  INVESTMENT = "Investment",
  PAYMENT_RECEIVED = "Payment Received",
  EXPENSE = "Expense",
  PAYMENT_PAID = "Payment Paid",
}

export const REPORT_TYPE_LABEL: Record<string, ReportItemType> = {
  cash_sale: ReportItemType.CASH_SALE,
  investment: ReportItemType.INVESTMENT,
  payment: ReportItemType.PAYMENT_RECEIVED,
  expense: ReportItemType.EXPENSE,
  purchase_payment: ReportItemType.PAYMENT_PAID,
};

export interface DailyBreakdownResponse {
  date: string;
  type: TransactionType;
  amount: number;
  notes: string | null;
  heading: string | null;
  sub_heading: string | null;
  customer_name: string | null;
  vendor_name: string | null;
  invoice_id?: string | null;
}

export interface DashboardDailyResponse {
  message: string;
  items: DailyBreakdownResponse[];
}

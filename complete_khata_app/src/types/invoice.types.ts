export enum SaleType {
  CASH = "cash",
  CREDIT = "credit",
}

export enum PurchaseType {
  CASH = "cash",
  CREDIT = "credit",
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_type: string;
  weight_per_unit: number | null;
  total_weight: number | null;
  unit_price: number;
  total_price: number;
}

export interface PurchaseInvoicePayment {
  id: string;
  amount: number;
  payment_date: string;
  created_at: string;
  notes?: string | null;
}

export interface InvoiceItemCreate {
  description: string;
  quantity: number;
  unit_type?: string;
  weight_per_unit?: number;
  total_weight?: number;
  unit_price: number;
  is_custom?: boolean;
}

// ── Sales Invoice ──────────────────────────────────────────────────────────────

export interface SalesInvoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  sale_type: SaleType;
  subtotal: number;
  discount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  notes: string | null;
  invoice_date: string;
  due_date: string | null;
  items: InvoiceItem[];
  payments: InvoicePayment[];
  created_at: string;
  updated_at: string;
}

export interface SalesInvoiceCreate {
  invoice_number?: string;
  customer_id: string;
  sale_type: SaleType;
  items: InvoiceItemCreate[];
  amount_paid?: number;
  discount?: number;
  notes?: string;
  invoice_date: string;
  due_date?: string;
}

export interface PaymentRequest {
  amount: number;
  payment_date: string;
  notes?: string;
}

export interface InvoicePayment {
  id: string;
  amount: number;
  payment_date: string;
  created_at: string;
  notes?: string | null;
}

export interface SalesInvoiceListResponse {
  message: string;
  total: number;
  items: SalesInvoice[];
}

export interface SalesInvoiceSuccessResponse {
  message: string;
  invoice: SalesInvoice;
}

// ── Purchase Invoice ───────────────────────────────────────────────────────────

export interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  vendor_id: string;
  purchase_type: PurchaseType;
  subtotal: number;
  discount: number;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  notes: string | null;
  invoice_date: string;
  due_date: string | null;
  items: InvoiceItem[];
  payments: PurchaseInvoicePayment[];
  created_at: string;
  updated_at: string;
}

export interface PurchaseInvoiceCreate {
  invoice_number?: string;
  vendor_id: string;
  purchase_type: PurchaseType;
  items: InvoiceItemCreate[];
  amount_paid?: number;
  discount?: number;
  notes?: string;
  invoice_date: string;
  due_date?: string;
}

export interface PurchaseInvoiceListResponse {
  total: number;
  items: PurchaseInvoice[];
}

export interface ReminderInvoice {
  id: string;
  invoice_number: string;
  party_name: string;
  balance_due: number;
  due_date: string | null;
}

export interface RemindersResponse {
  sales_unpaid_count: number;
  purchase_unpaid_count: number;
  sales_unpaid: ReminderInvoice[];
  purchase_unpaid: ReminderInvoice[];
}

import { differenceInCalendarDays, format, parseISO } from "date-fns";

export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatCurrency(amount: number, currency = "PKR"): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateString: string | null | undefined, fmt = "dd MMM yyyy"): string {
  if (!dateString) return "—";
  try {
    return format(parseISO(dateString), fmt);
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string | null | undefined): string {
  return formatDate(dateString, "dd MMM yyyy, HH:mm");
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-PK").format(value);
}

export function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function invoiceStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Draft",
    confirmed: "Confirmed",
    paid: "Paid",
    partial: "Partially Paid",
    cancelled: "Cancelled",
  };
  return labels[status] ?? capitalizeFirst(status);
}

export function isOverdue(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  return differenceInCalendarDays(parseISO(dueDate), new Date()) < 0;
}

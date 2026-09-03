import { cn } from "@/utils/cn";

type BadgeVariant = "success" | "warning" | "error" | "info" | "neutral";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  success: "bg-green-100 text-green-800",
  warning: "bg-yellow-100 text-yellow-800",
  error:   "bg-red-100 text-red-800",
  info:    "bg-blue-100 text-blue-800",
  neutral: "bg-gray-100 text-gray-700",
};

export function Badge({ variant = "neutral", children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: BadgeVariant; label: string }> = {
    draft:     { variant: "neutral",  label: "Draft" },
    confirmed: { variant: "info",     label: "Confirmed" },
    paid:      { variant: "success",  label: "Paid" },
    partial:   { variant: "warning",  label: "Partial" },
    cancelled: { variant: "error",    label: "Cancelled" },
    pending:   { variant: "warning",  label: "Pending" },
    overdue:   { variant: "error",    label: "Overdue" },
  };
  const c = config[status] ?? { variant: "neutral" as BadgeVariant, label: status };
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

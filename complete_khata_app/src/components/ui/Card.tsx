import { cn } from "@/utils/cn";
import Link from "next/link";

interface CardProps {
  className?: string;
  children: React.ReactNode;
  href?: string;
}

export function Card({ className, children, href }: CardProps) {
  if (href) {
    return (
      <Link href={href} className="block cursor-pointer transition hover:shadow-md">
        <div className={cn("rounded-xl border border-gray-200 bg-white shadow-sm", className)}>
          {children}
        </div>
      </Link>
    );
  }
  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: CardProps) {
  return (
    <div className={cn("border-b border-gray-100 px-4 py-4 sm:px-6", className)}>
      {children}
    </div>
  );
}

export function CardBody({ className, children }: CardProps) {
  return <div className={cn("px-4 py-4 sm:px-6", className)}>{children}</div>;
}

export function StatCard({
  label,
  value,
  icon,
  color = "blue",
  href,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: "blue" | "green" | "yellow" | "red" | "purple";
  href?: string;
}) {
  const colors: Record<string, string> = {
    blue:   "bg-blue-50 text-blue-600",
    green:  "bg-green-50 text-green-600",
    yellow: "bg-yellow-50 text-yellow-600",
    red:    "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
  };
  const card = (
    <Card>
      <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {icon && (
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg sm:h-11 sm:w-11 lg:h-12 lg:w-12", colors[color])}>
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs text-gray-500 sm:text-sm">{label}</p>
          <p className="whitespace-nowrap text-lg font-bold text-gray-900 sm:text-xl lg:text-2xl">{value}</p>
        </div>
      </CardBody>
    </Card>
  );
  if (href) {
    return (
      <Link href={href} className="block cursor-pointer transition hover:shadow-md">
        {card}
      </Link>
    );
  }
  return card;
}

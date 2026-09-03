import { cn } from "@/utils/cn";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <main className={cn("flex-1 overflow-y-auto bg-gray-50 p-3 sm:p-4 lg:p-6", className)}>
      <div className="mx-auto w-full max-w-7xl space-y-5 sm:space-y-6">{children}</div>
    </main>
  );
}

import { cn } from "@/utils/cn";

interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  className?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function Table<T>({ columns, data, keyExtractor, isLoading, emptyMessage = "No records found" }: TableProps<T>) {
  return (
    <div className="w-full">
      <div className="hidden w-full overflow-x-auto rounded-xl border border-gray-200 bg-white lg:block">
        <table className="min-w-max divide-y divide-gray-200 lg:min-w-full">
          <thead>
            <tr className="bg-gray-50">
              {columns.map((col, i) => (
                <th
                  key={i}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-700",
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-gray-400">
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={keyExtractor(row)} className="transition-colors hover:bg-gray-50">
                  {columns.map((col, i) => (
                    <td key={i} className={cn("px-4 py-3 text-sm text-gray-900", col.className)}>
                      {typeof col.accessor === "function"
                        ? col.accessor(row)
                        : String(row[col.accessor] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 lg:hidden">
        {isLoading ? (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-400">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          </div>
        ) : data.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-400">
            {emptyMessage}
          </div>
        ) : (
          data.map((row) => (
            <div key={keyExtractor(row)} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {columns.map((col, i) => {
                  const isActions = col.header.trim().toLowerCase() === "actions";
                  const value =
                    typeof col.accessor === "function"
                      ? col.accessor(row)
                      : String(row[col.accessor] ?? "—");

                  if (isActions) {
                    return (
                      <div
                        key={i}
                        className="col-span-2 mt-1 flex items-center justify-between border-t border-gray-100 pt-3"
                      >
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                          {col.header}
                        </span>
                        <span className="flex gap-2">{value}</span>
                      </div>
                    );
                  }

                  return (
                    <div key={i} className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                        {col.header}
                      </span>
                      <span className="text-sm text-gray-900 break-words">{value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function Pagination({
  total,
  skip,
  limit,
  onPageChange,
}: {
  total: number;
  skip: number;
  limit: number;
  onPageChange: (skip: number) => void;
}) {
  const currentPage = Math.floor(skip / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex flex-col gap-3 text-sm text-gray-600 sm:flex-row sm:items-center sm:justify-between">
      <span>
        Showing {skip + 1}–{Math.min(skip + limit, total)} of {total}
      </span>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onPageChange(Math.max(0, skip - limit))}
          disabled={skip === 0}
          className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 font-medium text-blue-700">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(skip + limit)}
          disabled={skip + limit >= total}
          className="rounded-lg border border-gray-300 px-3 py-1.5 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
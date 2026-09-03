"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Table, Pagination } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { DeleteModal } from "@/components/ui/DeleteModal";
import { ToastContainer } from "@/components/ui/Toast";
import { StatCard, Card, CardBody, CardHeader } from "@/components/ui/Card";
import { cashSalesService } from "@/services/cash-sales.service";
import { formatCurrency, formatDate, getLocalDateString } from "@/utils/formatters";
import { extractErrorMessage } from "@/services/api";
import { CashSale } from "@/types/cash-sale.types";
import { useToast } from "@/hooks/useToast";

const schema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  from_date: z.string().min(1, "From date is required"),
  to_date: z.string().min(1, "To date is required"),
  notes: z.string().optional(),
});
type CashSaleForm = z.infer<typeof schema>;

const LIMIT = 20;

type CashSalePeriod = "1d" | "7d" | "3m" | "6m" | "1y";

const PERIOD_LABELS: Record<CashSalePeriod, string> = {
  "1d": "1 Day",
  "7d": "7 Days",
  "3m": "3 Months",
  "6m": "6 Months",
  "1y": "1 Year",
};

function getPeriodDates(period: CashSalePeriod): { from_date: string; to_date: string } {
  const today = new Date();
  const to = getLocalDateString(today);
  const from = new Date(today);

  if (period === "1d") {
    from.setDate(from.getDate() - 1);
  } else if (period === "7d") {
    from.setDate(from.getDate() - 6);
  } else if (period === "3m") {
    from.setMonth(from.getMonth() - 3);
  } else if (period === "6m") {
    from.setMonth(from.getMonth() - 6);
  } else if (period === "1y") {
    from.setFullYear(from.getFullYear() - 1);
  }

  return {
    from_date: getLocalDateString(from),
    to_date: to,
  };
}

export default function CashSalesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [skip, setSkip] = useState(0);
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [selectedPeriod, setSelectedPeriod] = useState<CashSalePeriod>("7d");
  const [fromDate, setFromDate] = useState(getLocalDateString());
  const [toDate, setToDate] = useState(getLocalDateString());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CashSale | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CashSale | null>(null);

  const queryParams = useMemo(() => {
    if (mode === "custom" && fromDate && toDate) {
      return { from_date: fromDate, to_date: toDate };
    }
    return getPeriodDates(selectedPeriod);
  }, [mode, selectedPeriod, fromDate, toDate]);

  const { data, isLoading } = useQuery({
    queryKey: ["cash-sales", skip, mode, selectedPeriod, fromDate, toDate],
    queryFn: () => cashSalesService.list({ skip, limit: LIMIT, ...queryParams }),
  });

  const { data: summary } = useQuery({
    queryKey: ["cash-sales", "summary", mode, selectedPeriod, fromDate, toDate],
    queryFn: () => cashSalesService.getSummary(queryParams),
  });

  const filteredItems = data?.items ?? [];

  const filteredSummary = useMemo(() => {
    if (!summary) return null;
    return {
      total_amount: filteredItems.reduce((sum, item) => sum + item.amount, 0),
      total_count: filteredItems.length,
    };
  }, [summary, filteredItems]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CashSaleForm>({ resolver: zodResolver(schema) });

  const createMutation = useMutation({
    mutationFn: cashSalesService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash-sales"] });
      setModalOpen(false);
      reset();
      toast.success("Cash sale added successfully");
    },
    onError: (e) => {
      const msg = extractErrorMessage(e);
      setFormError(msg);
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CashSaleForm }) =>
      cashSalesService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cash-sales"] });
      setModalOpen(false);
      reset();
      setEditing(null);
      toast.success("Cash sale updated successfully");
    },
    onError: (e) => {
      const msg = extractErrorMessage(e);
      setFormError(msg);
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: cashSalesService.delete,
    onSuccess: () => {
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["cash-sales"] });
      toast.success("Cash sale deleted permanently");
    },
    onError: (e) => toast.error(extractErrorMessage(e)),
  });

  function openCreate() {
    setEditing(null);
    reset({ from_date: getLocalDateString(), to_date: getLocalDateString(), notes: "" });
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(item: CashSale) {
    setEditing(item);
    reset({
      amount: item.amount,
      from_date: item.from_date,
      to_date: item.to_date,
      notes: item.notes || "",
    });
    setFormError(null);
    setModalOpen(true);
  }

  function onSubmit(form: CashSaleForm) {
    setFormError(null);
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  }

  const columns = [
    { header: "From", accessor: (r: CashSale) => formatDate(r.from_date) },
    { header: "To", accessor: (r: CashSale) => formatDate(r.to_date) },
    { header: "Amount", accessor: (r: CashSale) => formatCurrency(r.amount) },
    { header: "Notes", accessor: (r: CashSale) => r.notes || <span className="text-gray-400">—</span> },
    {
      header: "Actions",
      accessor: (r: CashSale) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-gray-400 hover:bg-blue-50 hover:text-blue-700"
            onClick={() => openEdit(r)}
            aria-label="Edit cash sale"
            title="Edit"
          >
            <Pencil size={16} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-gray-400 hover:bg-red-50 hover:text-red-700"
            onClick={() => setDeleteTarget(r)}
            aria-label="Delete cash sale"
            title="Delete"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />

      <Header
        title="Cash Sales"
        actions={
          <Button onClick={openCreate} size="sm" className="px-2 py-1.5 sm:px-3 sm:py-1.5">
            <Plus size={16} />
            <span className="hidden sm:inline"> Add Cash Sale</span>
          </Button>
        }
      />

      <PageContainer>
        <StatCard
          label="Total Cash Sales"
          value={summary ? formatCurrency(summary.total_amount) : "—"}
          icon={<Plus size={22} />}
          color="green"
        />

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">Cash Sales</h2>
              <p className="text-sm text-gray-500">
                {mode === "custom"
                  ? `${formatDate(fromDate)} to ${formatDate(toDate)}`
                  : `${PERIOD_LABELS[selectedPeriod]} total`}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PERIOD_LABELS) as CashSalePeriod[]).map((period) => (
                  <Button
                    key={period}
                    type="button"
                    size="sm"
                    variant={mode === "preset" && selectedPeriod === period ? "primary" : "secondary"}
                    onClick={() => {
                      const dates = getPeriodDates(period);
                      setMode("preset");
                      setSelectedPeriod(period);
                      setFromDate(dates.from_date);
                      setToDate(dates.to_date);
                      setSkip(0);
                    }}
                  >
                    {PERIOD_LABELS[period]}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <Input
                  label="From"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-8 w-auto text-xs"
                />
                <Input
                  label="To"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-8 w-auto text-xs"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setMode("custom");
                    setSkip(0);
                  }}
                >
                  Apply
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase text-gray-500">Period Total</p>
                <p className="mt-1 whitespace-nowrap text-2xl font-bold text-gray-900">
                  {filteredSummary ? formatCurrency(filteredSummary.total_amount) : "—"}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs font-medium uppercase text-gray-500">Records Found</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">
                  {filteredItems.length}
                </p>
              </div>
            </div>

            <Table
              columns={columns}
              data={filteredItems}
              keyExtractor={(r) => r.id}
              isLoading={isLoading}
            />

            {filteredItems.length > LIMIT && (
              <Pagination
                total={filteredItems.length}
                skip={skip}
                limit={LIMIT}
                onPageChange={setSkip}
              />
            )}
          </CardBody>
        </Card>
      </PageContainer>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Cash Sale" : "Add Cash Sale"}>
        {formError && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Amount"
            type="number"
            step="1"
            error={errors.amount?.message}
            required
            {...register("amount")}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="From Date"
              type="date"
              error={errors.from_date?.message}
              required
              {...register("from_date")}
            />
            <Input
              label="To Date"
              type="date"
              error={errors.to_date?.message}
              required
              {...register("to_date")}
            />
          </div>
          <Textarea
            label="Notes"
            error={errors.notes?.message}
            {...register("notes")}
          />
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>
              {editing ? "Update" : "Save"}
            </Button>
          </div>
        </form>
      </Modal>

      <DeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete Cash Sale"
        message={`Are you sure you want to delete cash sale #${deleteTarget?.id.slice(0, 8)}? This action cannot be undone.`}
        isLoading={deleteMutation.isPending}
      />
    </>
  );
}

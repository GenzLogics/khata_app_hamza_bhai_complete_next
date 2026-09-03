"use client";

import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, BarChart3, Settings, Check, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Table, Pagination } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { DeleteModal } from "@/components/ui/DeleteModal";
import { ToastContainer } from "@/components/ui/Toast";
import { StatCard, Card, CardBody, CardHeader } from "@/components/ui/Card";
import { expensesService } from "@/services/expenses.service";
import { formatCurrency, formatDate, getLocalDateString } from "@/utils/formatters";
import { extractErrorMessage } from "@/services/api";
import { Expense, ExpenseHeading } from "@/types/expense.types";
import { useToast } from "@/hooks/useToast";

const schema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  from_date: z.string().min(1, "From date is required"),
  to_date: z.string().min(1, "To date is required"),
  heading: z.string().min(1, "Heading is required"),
  new_heading: z.string().optional(),
  sub_heading: z.string().optional(),
  notes: z.string().optional(),
});
type ExpenseForm = z.infer<typeof schema>;
type ExpenseFormExt = ExpenseForm & { new_heading?: string };

const LIMIT = 20;

type ExpensePeriod = "1d" | "7d" | "3m" | "6m" | "1y";

const PERIOD_LABELS: Record<ExpensePeriod, string> = {
  "1d": "1 Day",
  "7d": "7 Days",
  "3m": "3 Months",
  "6m": "6 Months",
  "1y": "1 Year",
};

function getPeriodDates(period: ExpensePeriod): { from_date: string; to_date: string } {
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

export default function ExpensesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [skip, setSkip] = useState(0);
  const [selectedHeading, setSelectedHeading] = useState<string | null>(null);
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [selectedPeriod, setSelectedPeriod] = useState<ExpensePeriod>("7d");
  const [fromDate, setFromDate] = useState(getLocalDateString());
  const [toDate, setToDate] = useState(getLocalDateString());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [renamingHeading, setRenamingHeading] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingHeading, setDeletingHeading] = useState<string | null>(null);

  const queryParams = useMemo(() => {
    if (mode === "custom" && fromDate && toDate) {
      return { from_date: fromDate, to_date: toDate };
    }
    return { period: selectedPeriod };
  }, [mode, selectedPeriod, fromDate, toDate]);

  const { data, isLoading } = useQuery({
    queryKey: ["expenses", skip, mode, selectedPeriod, fromDate, toDate],
    queryFn: () => {
      if (mode === "custom") {
        return expensesService.list({ skip, limit: LIMIT, from_date: fromDate, to_date: toDate });
      }
      const dates = getPeriodDates(selectedPeriod);
      return expensesService.list({ skip, limit: LIMIT, ...dates });
    },
  });

  const filteredItems = useMemo(() => {
    if (!selectedHeading || !data?.items) return data?.items ?? [];
    return data.items.filter((item) => item.heading === selectedHeading);
  }, [data?.items, selectedHeading]);

  const { data: summary } = useQuery({
    queryKey: ["expenses", "summary", mode, selectedPeriod, fromDate, toDate],
    queryFn: () => {
      if (mode === "custom") {
        return expensesService.getSummary({ from_date: fromDate, to_date: toDate });
      }
      const dates = getPeriodDates(selectedPeriod);
      return expensesService.getSummary(dates);
    },
  });

  const filteredSummary = useMemo(() => {
    if (!selectedHeading || !filteredItems) return summary;
    return {
      total_amount: filteredItems.reduce((sum, item) => sum + item.amount, 0),
    };
  }, [filteredItems, selectedHeading, summary]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ExpenseFormExt>({ resolver: zodResolver(schema) });
  const [addingHeading, setAddingHeading] = useState(false);

  const allHeadings = useMemo(() => {
    const presets = Object.values(ExpenseHeading) as string[];
    const dynamic = data?.items ? Array.from(new Set(data.items.map((i) => i.heading))) : [];
    return Array.from(new Set([...presets, ...dynamic])).filter((h) => h !== "__NEW__");
  }, [data?.items]);

  const customHeadings = useMemo(
    () => allHeadings.filter((h) => !(Object.values(ExpenseHeading) as string[]).includes(h)),
    [allHeadings],
  );

  const watchedHeading = watch("heading");
  useEffect(() => {
    setAddingHeading(watchedHeading === "__NEW__");
  }, [watchedHeading]);

  const createMutation = useMutation({
    mutationFn: expensesService.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      setModalOpen(false);
      reset();
      toast.success("Expense added successfully");
    },
    onError: (e) => {
      const msg = extractErrorMessage(e);
      setFormError(msg);
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ExpenseForm }) =>
      expensesService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      setModalOpen(false);
      reset();
      setEditing(null);
      toast.success("Expense updated successfully");
    },
    onError: (e) => {
      const msg = extractErrorMessage(e);
      setFormError(msg);
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: expensesService.delete,
    onSuccess: () => {
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense deleted permanently");
    },
    onError: (e) => toast.error(extractErrorMessage(e)),
  });

  const renameHeadingMutation = useMutation({
    mutationFn: ({ oldHeading, newHeading }: { oldHeading: string; newHeading: string }) =>
      expensesService.renameHeading(oldHeading, newHeading),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Heading renamed");
      setManageOpen(false);
    },
    onError: (e) => toast.error(extractErrorMessage(e)),
  });

  const deleteHeadingMutation = useMutation({
    mutationFn: expensesService.deleteHeading,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Heading deleted");
      setManageOpen(false);
    },
    onError: (e) => toast.error(extractErrorMessage(e)),
  });

  function openCreate() {
    setEditing(null);
    setAddingHeading(false);
    reset({ from_date: getLocalDateString(), to_date: getLocalDateString(), heading: ExpenseHeading.MALL_KHATA, sub_heading: "", notes: "", new_heading: "" });
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(e: Expense) {
    setEditing(e);
    const presetValues = Object.values(ExpenseHeading) as string[];
    if (presetValues.includes(e.heading)) {
      reset({
        amount: e.amount,
        from_date: e.from_date,
        to_date: e.to_date,
        heading: e.heading,
        sub_heading: e.sub_heading ?? "",
        notes: e.notes ?? "",
        new_heading: "",
      });
      setAddingHeading(false);
    } else {
      reset({
        amount: e.amount,
        from_date: e.from_date,
        to_date: e.to_date,
        heading: "__NEW__",
        sub_heading: e.sub_heading ?? "",
        notes: e.notes ?? "",
        new_heading: e.heading,
      });
      setAddingHeading(true);
    }
    setFormError(null);
    setModalOpen(true);
  }

  function startRename(h: string) {
    setRenamingHeading(h);
    setRenameValue(h);
  }

  function confirmRename() {
    const next = renameValue.trim();
    if (renamingHeading && next && next !== renamingHeading) {
      renameHeadingMutation.mutate({ oldHeading: renamingHeading, newHeading: next });
    }
    setRenamingHeading(null);
  }

  function onDeleteHeading() {
    if (deletingHeading) {
      deleteHeadingMutation.mutate(deletingHeading);
      setDeletingHeading(null);
    }
  }

  function onSubmit(form: ExpenseFormExt) {
    setFormError(null);
    const headingValue = form.new_heading && form.new_heading.trim().length ? form.new_heading.trim() : form.heading;
    const payload = {
      amount: form.amount,
      from_date: form.from_date,
      to_date: form.to_date,
      heading: headingValue,
      sub_heading: form.sub_heading,
      notes: form.notes,
    };
    if (editing) updateMutation.mutate({ id: editing.id, data: payload as any });
    else createMutation.mutate(payload as any);
  }

  const columns = [
    { header: "From", accessor: (r: Expense) => formatDate(r.from_date) },
    { header: "To", accessor: (r: Expense) => formatDate(r.to_date) },
    { header: "Amount", accessor: (r: Expense) => formatCurrency(r.amount) },
    { header: "Heading", accessor: (r: Expense) => r.heading },
    { header: "Sub Heading", accessor: (r: Expense) => r.sub_heading ?? "—" },
    { header: "Notes", accessor: (r: Expense) => r.notes ?? "—" },
    {
      header: "Actions",
      accessor: (r: Expense) => (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => openEdit(r)}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-700"
            aria-label="Edit expense"
            title="Edit"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(r)}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-700"
            aria-label="Delete expense"
            title="Delete"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />

      <Header
        title={selectedHeading ? `Expenses: ${selectedHeading}` : "Shop Expenses"}
        actions={
          <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
            {selectedHeading && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => { setSelectedHeading(null); setSkip(0); }}
                className="px-2 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm"
              >
                ← Back
              </Button>
            )}
            <Button onClick={openCreate} size="sm" className="px-2 py-1.5 sm:px-3 sm:py-1.5">
              <Plus size={16} />
              <span className="hidden sm:inline"> Add Expense</span>
            </Button>
            <Button
              type="button"
              onClick={() => setManageOpen(true)}
              size="sm"
              variant="secondary"
              disabled={customHeadings.length === 0}
              className="px-2 py-1.5 sm:px-3 sm:py-1.5"
            >
              <Settings size={16} />
              <span className="hidden sm:inline"> Manage Headings</span>
            </Button>
          </div>
        }
      />

      <PageContainer>
        <StatCard
          label="Total Expenses"
          value={summary ? formatCurrency(summary.total_amount) : "—"}
          icon={<BarChart3 size={22} />}
          color="red"
        />

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">
                {selectedHeading ? selectedHeading : "Expenses"}
              </h2>
              <p className="text-sm text-gray-500">
                {selectedHeading
                  ? `All expenses under "${selectedHeading}"`
                  : mode === "custom"
                    ? `${fromDate} to ${toDate}`
                    : `${PERIOD_LABELS[selectedPeriod]} total`}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(PERIOD_LABELS) as ExpensePeriod[]).map((period) => (
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
            {!selectedHeading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {allHeadings.map((heading) => {
                  const headingTotal = filteredItems
                    .filter((item) => item.heading === heading)
                    .reduce((sum, item) => sum + item.amount, 0);
                  const count = filteredItems.filter((item) => item.heading === heading).length;
                  return (
                    <button
                      key={heading}
                      onClick={() => setSelectedHeading(heading)}
                      className="rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:border-blue-500 hover:bg-blue-50"
                    >
                      <p className="text-sm font-medium text-gray-900">{heading}</p>
                      <p className="mt-1 text-lg font-bold text-gray-900">{formatCurrency(headingTotal)}</p>
                      <p className="text-xs text-gray-500">{count} records</p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
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
              </>
            )}
          </CardBody>
        </Card>
      </PageContainer>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Expense" : "Add Expense"}
      >
        {formError && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Amount (PKR)"
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
          <div className="flex flex-col gap-2">
            <Select
              label="Heading"
              error={errors.heading?.message}
              required
              {...register("heading")}
              options={[...allHeadings.map((h) => ({ value: h, label: h })), { value: "__NEW__", label: "Add new heading..." }]}
            />
            {addingHeading && (
              <Input
                label="New Heading"
                error={errors.heading?.message}
                required
                {...register("new_heading")}
              />
            )}
          </div>
          <Input
            label="Sub Heading"
            error={errors.sub_heading?.message}
            {...register("sub_heading")}
          />
          <Textarea
            label="Notes"
            error={errors.notes?.message}
            {...register("notes")}
          />
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editing ? "Save" : "Add Expense"}
            </Button>
          </div>
        </form>
      </Modal>

      <DeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        isLoading={deleteMutation.isPending}
        title="Delete Expense"
        itemName={deleteTarget?.notes ?? undefined}
      />

      <Modal
        isOpen={manageOpen}
        onClose={() => setManageOpen(false)}
        title="Manage Headings"
        size="sm"
      >
        {customHeadings.length === 0 ? (
          <p className="text-sm text-gray-500">No custom headings added yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {customHeadings.map((heading) => (
              <li
                key={heading}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
              >
                {renamingHeading === heading ? (
                  <Input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmRename();
                      if (e.key === "Escape") setRenamingHeading(null);
                    }}
                    className="h-8 text-sm"
                  />
                ) : (
                  <span className="text-sm text-gray-900">{heading}</span>
                )}
                <div className="ml-2 flex items-center gap-1">
                  {renamingHeading === heading ? (
                    <>
                      <button
                        type="button"
                        onClick={confirmRename}
                        className="rounded p-0.5 text-gray-400 hover:text-blue-700"
                        aria-label="Save"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingHeading(null)}
                        className="rounded p-0.5 text-gray-400 hover:text-red-600"
                        aria-label="Cancel"
                      >
                        <X size={15} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startRename(heading)}
                        className="rounded p-0.5 text-gray-400 hover:text-blue-700"
                        aria-label="Rename"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingHeading(heading)}
                        className="rounded p-0.5 text-gray-400 hover:text-red-700"
                        aria-label="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <DeleteModal
        isOpen={!!deletingHeading}
        onClose={() => setDeletingHeading(null)}
        onConfirm={onDeleteHeading}
        isLoading={deleteHeadingMutation.isPending}
        title="Delete Heading"
        itemName={deletingHeading ?? undefined}
      />
    </>
  );
}

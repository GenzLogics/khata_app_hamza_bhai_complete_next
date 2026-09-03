"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, Pagination } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { DeleteModal } from "@/components/ui/DeleteModal";
import { StatCard } from "@/components/ui/Card";
import { SearchField } from "@/components/ui/SearchField";
import { investorsService } from "@/services/investors.service";
import { formatCurrency, formatDate, getLocalDateString } from "@/utils/formatters";
import { extractErrorMessage } from "@/services/api";
import type { Investor, InvestorCreate, InvestorUpdate } from "@/types/investor.types";
import { useDebounce } from "@/hooks/useDebounce";

const schema = z.object({
  investor_name: z.string().optional(),
  investment_amount: z.coerce.number().positive("Amount must be greater than 0"),
  investment_date: z.string().optional(),
  notes: z.string().optional(),
});

type Form = z.infer<typeof schema>;

const LIMIT = 20;
const today = getLocalDateString();

function toPayload(form: Form): InvestorCreate {
  return {
    investment_amount: form.investment_amount,
    investor_name: form.investor_name?.trim() || undefined,
    investment_date: form.investment_date?.trim() || undefined,
    notes: form.notes?.trim() || undefined,
  };
}

export default function InvestorsPage() {
  const qc = useQueryClient();
  const [skip, setSkip] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Investor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Investor | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["investors", skip, debouncedSearch],
    queryFn: () => investorsService.list({ skip, limit: LIMIT, search: debouncedSearch || undefined }),
  });
  const { data: summary } = useQuery({
    queryKey: ["investors", "summary"],
    queryFn: () => investorsService.getSummary(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      investment_date: today,
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: InvestorCreate) => investorsService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["investors"] });
      setModalOpen(false);
      reset();
    },
    onError: (e) => setFormError(extractErrorMessage(e)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: InvestorUpdate }) => investorsService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["investors"] });
      setModalOpen(false);
      reset();
      setEditing(null);
    },
    onError: (e) => setFormError(extractErrorMessage(e)),
  });
  const deleteMutation = useMutation({
    mutationFn: investorsService.delete,
    onSuccess: () => {
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["investors"] });
    },
  });

  function openCreate() {
    setEditing(null);
    reset({ investor_name: "", investment_date: today, notes: "" });
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(inv: Investor) {
    setEditing(inv);
    reset({
      investor_name: inv.investor_name ?? "",
      investment_amount: inv.investment_amount,
      investment_date: inv.investment_date ?? "",
      notes: inv.notes ?? "",
    });
    setFormError(null);
    setModalOpen(true);
  }

  function onSubmit(form: Form) {
    setFormError(null);
    const payload = toPayload(form);
    if (editing) updateMutation.mutate({ id: editing.id, data: payload });
    else createMutation.mutate(payload);
  }

  const columns = [
    {
      header: "Investor Name",
      accessor: (r: Investor) => r.investor_name?.trim() || "—",
    },
    { header: "Invested", accessor: (r: Investor) => formatCurrency(r.investment_amount) },
    { header: "Date", accessor: (r: Investor) => (r.investment_date ? formatDate(r.investment_date) : "N/A") },
    {
      header: "Notes",
      accessor: (r: Investor) => (
        <span className="truncate" title={r.notes ?? ""}>
          {r.notes?.trim() || "—"}
        </span>
      ),
    },
    {
      header: "Actions",
      accessor: (r: Investor) => (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => openEdit(r)}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-700"
            aria-label="Edit investor"
            title="Edit"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(r)}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-700"
            aria-label="Delete investor"
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
      <Header
        title="Investors"
        actions={
          <Button onClick={openCreate} size="sm" className="px-2 py-1.5 sm:px-3 sm:py-1.5">
            <Plus size={16} />
            <span className="hidden sm:inline"> Add Investor</span>
          </Button>
        }
      />
      <PageContainer>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard label="Total Invested" value={summary ? formatCurrency(summary.total_invested) : "—"} color="blue" />
          <StatCard label="Count" value={summary ? String(summary.count) : "—"} color="green" />
        </div>

        <SearchField
          value={search}
          onChange={(value) => {
            setSearch(value);
            setSkip(0);
          }}
          placeholder="Search by investor name or notes..."
        />

        <Table columns={columns} data={data?.items ?? []} keyExtractor={(r) => r.id} isLoading={isLoading} />
        {data && data.total > LIMIT && <Pagination total={data.total} skip={skip} limit={LIMIT} onPageChange={setSkip} />}
      </PageContainer>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Investor" : "Add Investor"}>
        {formError && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{formError}</div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Investor Name" error={errors.investor_name?.message} {...register("investor_name")} />
          <Input label="Investment Amount (PKR)" type="number" error={errors.investment_amount?.message} required {...register("investment_amount")} />
          <Input label="Investment Date" type="date" error={errors.investment_date?.message} {...register("investment_date")} />
          <Input label="Notes" error={errors.notes?.message} {...register("notes")} />
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>
              {editing ? "Save" : "Add Investor"}
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
        title="Delete Investor"
        message={`Are you sure you want to delete "${deleteTarget?.investor_name?.trim() || "this investor"}"?`}
      />
    </>
  );
}

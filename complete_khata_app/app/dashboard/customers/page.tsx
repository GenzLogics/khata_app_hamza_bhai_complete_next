"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { ShoppingCart, CreditCard, Receipt } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, Pagination } from "@/components/ui/Table";
import { Card, CardBody, StatCard } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { ToastContainer } from "@/components/ui/Toast";
import { DeleteModal } from "@/components/ui/DeleteModal";
import { CountryPhoneField } from "@/components/forms/CountryPhoneField";
import { SearchField } from "@/components/ui/SearchField";
import { customersService } from "@/services/customers.service";
import { salesInvoicesService } from "@/services/sales-invoices.service";
import { formatCurrency, formatDate } from "@/utils/formatters";
import { extractErrorMessage } from "@/services/api";
import type { Customer } from "@/types/customer.types";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/hooks/useToast";

const customerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional().refine(
    (val) => !val || /^\+\d{7,15}$/.test(val),
    "Enter a valid phone number with country code"
  ),
});

type CustomerForm = z.infer<typeof customerSchema>;

const LIMIT = 20;

export default function CustomersPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [skip, setSkip] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [phoneFieldKey, setPhoneFieldKey] = useState(0);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const handleClearDates = () => {
    setFromDate("");
    setToDate("");
  };

  const { data, isLoading } = useQuery({
    queryKey: ["customers", skip, debouncedSearch],
    queryFn: () => customersService.list({ skip, limit: LIMIT, search: debouncedSearch || undefined }),
  });

  const { data: salesInvoicesData } = useQuery({
    queryKey: ["sales-invoices", "customers-page", fromDate, toDate],
    queryFn: () => salesInvoicesService.list({ limit: 200, from_date: fromDate || undefined, to_date: toDate || undefined }),
  });

  const salesInvoices = salesInvoicesData?.items ?? [];
  const totalAmount = salesInvoices.reduce((sum, invoice) => sum + Number(invoice.total_amount ?? 0), 0);
  const totalPaid = salesInvoices.reduce((sum, invoice) => sum + Number(invoice.amount_paid ?? 0), 0);
  const totalBalance = salesInvoices.reduce((sum, invoice) => sum + Number(invoice.balance_due ?? 0), 0);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CustomerForm>({
    resolver: zodResolver(customerSchema),
  });

  const createMutation = useMutation({
    mutationFn: (data: CustomerForm) => customersService.create({ name: data.name, phone: data.phone || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setModalOpen(false);
      reset();
      toast.success("Customer created successfully");
    },
    onError: (e) => {
      const msg = extractErrorMessage(e);
      setFormError(msg);
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CustomerForm }) =>
      customersService.update(id, { name: data.name, phone: data.phone || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setModalOpen(false);
      reset();
      setEditing(null);
      toast.success("Customer updated successfully");
    },
    onError: (e) => {
      const msg = extractErrorMessage(e);
      setFormError(msg);
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: customersService.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      setDeleteTarget(null);
      toast.success("Customer deleted permanently");
    },
    onError: (e) => toast.error(extractErrorMessage(e)),
  });

  function openCreate() {
    setEditing(null);
    reset({ name: "", phone: "" });
    setFormError(null);
    setPhoneFieldKey((key) => key + 1);
    setModalOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    reset({ name: c.name, phone: c.phone ?? "" });
    setFormError(null);
    setPhoneFieldKey((key) => key + 1);
    setModalOpen(true);
  }

  function onSubmit(form: CustomerForm) {
    setFormError(null);
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  }

  const columns = [
    { header: "Name", accessor: "name" as const },
    { header: "Phone", accessor: "phone" as const },
      {
        header: "Credit",
        accessor: (r: Customer) => (
          <Link
            href={`/dashboard/customers/${r.id}`}
            className="font-semibold text-blue-700 hover:underline hover:text-blue-800"
          >
            {formatCurrency(r.credit_amount ?? 0)}
          </Link>
        ),
    },
    { header: "Added", accessor: (r: Customer) => formatDate(r.created_at) },
    {
      header: "Actions",
      accessor: (r: Customer) => (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => openEdit(r)}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-700"
            aria-label="Edit customer"
            title="Edit"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(r)}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-700"
            aria-label="Delete customer"
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
        title="Customers"
        actions={
          <Button onClick={openCreate} size="sm" className="px-2 py-1.5 sm:px-3 sm:py-1.5">
            <Plus size={16} />
            <span className="hidden sm:inline"> Add Customer</span>
          </Button>
        }
      />

      <PageContainer>
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-end gap-3 sm:flex-row sm:gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Start Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">End Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                />
              </div>
              <div>
                <Button size="sm" variant="secondary" onClick={handleClearDates}>
                  Clear
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {fromDate && toDate && (
          <p className="text-xs font-medium text-gray-500">
            Showing: {formatDate(fromDate, "dd MMM yyyy")} - {formatDate(toDate, "dd MMM yyyy")}
          </p>
        )}

        {!fromDate && !toDate && (
          <p className="text-xs font-medium text-gray-500">
            Complete Total — all sales invoices
          </p>
        )}

        <Card>
          <CardBody>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard label="Total Sales" value={formatCurrency(totalAmount)} icon={<ShoppingCart size={22} />} color="blue" />
              <StatCard label="Total Paid" value={formatCurrency(totalPaid)} icon={<CreditCard size={22} />} color="green" />
              <StatCard label="Balance Due" value={formatCurrency(totalBalance)} icon={<Receipt size={22} />} color="red" />
            </div>
          </CardBody>
        </Card>

        <SearchField
          value={search}
          onChange={(value) => {
            setSearch(value);
            setSkip(0);
          }}
          placeholder="Search by name or phone..."
        />

        <Table columns={columns} data={data?.items ?? []} keyExtractor={(r) => r.id} isLoading={isLoading} />

        {data && data.total > LIMIT && <Pagination total={data.total} skip={skip} limit={LIMIT} onPageChange={setSkip} />}
      </PageContainer>

      <DeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        isLoading={deleteMutation.isPending}
        title="Delete Customer"
        itemName={deleteTarget?.name}
        message={
          deleteTarget && Number(deleteTarget.credit_amount ?? 0) > 0
            ? `This customer has ${formatCurrency(deleteTarget.credit_amount)} pending credit. Clear the balance first, then delete.`
            : undefined
        }
      />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Customer" : "Add Customer"}>
        {formError && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{formError}</div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Full Name" error={errors.name?.message} required {...register("name")} />
          <CountryPhoneField
            key={phoneFieldKey}
            label="Phone"
            defaultValue={editing?.phone ?? ""}
            error={errors.phone?.message}
            onChange={(phone) => setValue("phone", phone, { shouldValidate: true })}
          />
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createMutation.isPending || updateMutation.isPending}>
              {editing ? "Save Changes" : "Create Customer"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

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
import { DeleteModal } from "@/components/ui/DeleteModal";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Card, CardBody, StatCard } from "@/components/ui/Card";
import { Pagination, Table } from "@/components/ui/Table";
import { ToastContainer } from "@/components/ui/Toast";
import { CountryPhoneField } from "@/components/forms/CountryPhoneField";
import { SearchField } from "@/components/ui/SearchField";
import { useDebounce } from "@/hooks/useDebounce";
import { useToast } from "@/hooks/useToast";
import { purchaseInvoicesService } from "@/services/purchase-invoices.service";
import { vendorsService } from "@/services/vendors.service";
import { extractErrorMessage } from "@/services/api";
import { formatCurrency, formatDate } from "@/utils/formatters";
import type { Vendor } from "@/types/vendor.types";

const LIMIT = 20;

const vendorSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional().refine(
    (val) => !val || /^\+\d{7,15}$/.test(val),
    "Enter a valid phone number with country code"
  ),
});

type VendorForm = z.infer<typeof vendorSchema>;

export default function VendorsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [skip, setSkip] = useState(0);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [phoneFieldKey, setPhoneFieldKey] = useState(0);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const handleClearDates = () => {
    setFromDate("");
    setToDate("");
  };

  const { data, isLoading } = useQuery({
    queryKey: ["vendors", skip, debouncedSearch],
    queryFn: () => vendorsService.list({ skip, limit: LIMIT, search: debouncedSearch || undefined }),
  });

  const { data: purchaseInvoicesData } = useQuery({
    queryKey: ["purchase-invoices", "vendors-page", fromDate, toDate],
    queryFn: () => purchaseInvoicesService.list({ limit: 200, from_date: fromDate || undefined, to_date: toDate || undefined }),
  });

  const vendorsWithBalance = (data?.items ?? []).map((vendor) => {
    const balance = (purchaseInvoicesData?.items ?? []).reduce((sum, invoice) => {
      return invoice.vendor_id === vendor.id ? sum + Number(invoice.balance_due ?? 0) : sum;
    }, 0);

    return {
      ...vendor,
      current_balance: balance || Number(vendor.current_balance ?? 0),
      debit_amount: Number(vendor.debit_amount ?? balance ?? 0),
      total_amount: (purchaseInvoicesData?.items ?? []).reduce((sum, invoice) => {
        return invoice.vendor_id === vendor.id ? sum + Number(invoice.total_amount ?? 0) : sum;
      }, 0),
    };
  });

  const invoices = purchaseInvoicesData?.items ?? [];
  const totalAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.total_amount ?? 0), 0);
  const totalPaid = invoices.reduce((sum, invoice) => sum + Number(invoice.amount_paid ?? 0), 0);
  const totalBalance = invoices.reduce((sum, invoice) => sum + Number(invoice.balance_due ?? 0), 0);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<VendorForm>({
    resolver: zodResolver(vendorSchema),
  });

  const createMutation = useMutation({
    mutationFn: (data: VendorForm) => vendorsService.create({ ...data, phone: data.phone || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      setModalOpen(false);
      reset();
      toast.success("Vendor created successfully");
    },
    onError: (e) => {
      const msg = extractErrorMessage(e);
      setFormError(msg);
      toast.error(msg);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: VendorForm }) =>
      vendorsService.update(id, { ...data, phone: data.phone || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      setModalOpen(false);
      reset();
      setEditing(null);
      toast.success("Vendor updated successfully");
    },
    onError: (e) => {
      const msg = extractErrorMessage(e);
      setFormError(msg);
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: vendorsService.deleteVendor,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      setDeleteTarget(null);
      toast.success("Vendor deleted successfully");
    },
    onError: (e) => {
      toast.error(extractErrorMessage(e));
    },
  });

  function openCreate() {
    setEditing(null);
    reset({ name: "", phone: "" });
    setFormError(null);
    setPhoneFieldKey((key) => key + 1);
    setModalOpen(true);
  }

  function openEdit(vendor: Vendor) {
    setEditing(vendor);
    reset({ name: vendor.name, phone: vendor.phone ?? "" });
    setFormError(null);
    setPhoneFieldKey((key) => key + 1);
    setModalOpen(true);
  }

  function onSubmit(form: VendorForm) {
    setFormError(null);
    if (editing) updateMutation.mutate({ id: editing.id, data: form });
    else createMutation.mutate(form);
  }

  const columns = [
    { header: "Name", accessor: "name" as const },
    { header: "Phone", accessor: "phone" as const },
    {
      header: "Amount Owed",
      accessor: (r: Vendor) => (
        <Link
          href={`/dashboard/vendors/${r.id}`}
          className="font-semibold text-blue-700 hover:underline hover:text-blue-800"
        >
          {formatCurrency(r.debit_amount)}
        </Link>
      ),
    },
    { header: "Added", accessor: (r: Vendor) => formatDate(r.created_at) },
    {
      header: "Actions",
      accessor: (r: Vendor) => (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => openEdit(r)}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-700"
            aria-label="Edit vendor"
            title="Edit"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(r)}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-700"
            aria-label="Delete vendor"
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
        title="Vendors"
        actions={
          <Button onClick={openCreate} size="sm" className="px-2 py-1.5 sm:px-3 sm:py-1.5">
            <Plus size={16} />
            <span className="hidden sm:inline"> Add Vendor</span>
          </Button>
        }
      />

      <PageContainer>
         <Card>
           <CardBody>
             <div className="flex flex-wrap items-end gap-3 sm:flex-row sm:items-end sm:gap-4">
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
             Complete Total — all purchase invoices
           </p>
         )}

         <Card>
           <CardBody>
             <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
               <StatCard label="Total Amount" value={formatCurrency(totalAmount)} icon={<ShoppingCart size={22} />} color="blue" />
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
          placeholder="Search vendors..."
        />

        <Table columns={columns} data={vendorsWithBalance} keyExtractor={(r) => r.id} isLoading={isLoading} />

        {data && data.total > LIMIT && <Pagination total={data.total} skip={skip} limit={LIMIT} onPageChange={setSkip} />}
      </PageContainer>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Vendor" : "Add Vendor"}>
        {formError && <div className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{formError}</div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Name" error={errors.name?.message} required {...register("name")} />
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
              {editing ? "Save Changes" : "Create Vendor"}
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
        title="Delete Vendor"
        message={
          deleteTarget && Number(deleteTarget.debit_amount ?? 0) > 0
            ? `This vendor has ${formatCurrency(deleteTarget.debit_amount)} pending balance. Clear the balance first, then delete.`
            : undefined
        }
        itemName={deleteTarget?.name}
      />
    </>
  );
}

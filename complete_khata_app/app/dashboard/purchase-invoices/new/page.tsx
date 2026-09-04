"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ToastContainer } from "@/components/ui/Toast";
import { extractErrorMessage } from "@/services/api";
import { purchaseInvoicesService } from "@/services/purchase-invoices.service";
import { vendorsService } from "@/services/vendors.service";
import { useToast } from "@/hooks/useToast";
import { formatCurrency, getLocalDateString } from "@/utils/formatters";
import { generateUUID } from "@/utils/uuid";
import { InvoiceItemCreate, PurchaseType } from "@/types/invoice.types";

type Row = InvoiceItemCreate & { id: string };

const today = getLocalDateString();
const DEFAULT_BAG_WEIGHT_KG = 50;
const MONEY_EPSILON = 1;

function newRow(description = ""): Row {
  return {
    id: generateUUID(),
    description,
    quantity: 1,
    unit_type: "bag",
    unit_price: 0,
  };
}

function lineWeight(row: Row) {
  return Number(row.total_weight ?? Number(row.quantity || 0) * Number(row.weight_per_unit || DEFAULT_BAG_WEIGHT_KG));
}

function lineAmount(row: Row) {
  return lineWeight(row) * Number(row.unit_price || 0);
}

export default function NewPurchaseInvoicePage() {
  const router = useRouter();
  const toast = useToast();
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [purchaseType, setPurchaseType] = useState<PurchaseType>(PurchaseType.CASH);
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [amountPaid, setAmountPaid] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [error, setError] = useState<string | null>(null);
  const [newVendorItem, setNewVendorItem] = useState("");
  const [isSavingItem, setIsSavingItem] = useState(false);

  const { data: vendors } = useQuery({
    queryKey: ["vendors", "purchase-invoice-select"],
    queryFn: () => vendorsService.list({ limit: 200 }),
  });

  const { data: vendorItems, refetch: refetchVendorItems } = useQuery({
    queryKey: ["vendors", vendorId, "items"],
    queryFn: () => vendorsService.getItems(vendorId),
    enabled: !!vendorId,
  });

  const relatedItems = vendorItems?.items ?? [];
  const vendorItemsListId = "vendor-item-suggestions";

  const subtotal = useMemo(
    () => rows.reduce((sum, row) => sum + lineAmount(row), 0),
    [rows]
  );
  const total = useMemo(
    () => Math.max(subtotal - discount, 0),
    [subtotal, discount]
  );
  const effectiveAmountPaid = purchaseType === PurchaseType.CASH ? total : amountPaid;
  const remaining = Math.max(total - effectiveAmountPaid, 0);

  const createMutation = useMutation({
    mutationFn: () =>
      purchaseInvoicesService.create({
        invoice_number: invoiceNumber.trim(),
        vendor_id: vendorId,
        purchase_type: purchaseType,
        invoice_date: invoiceDate,
        due_date: purchaseType === PurchaseType.CREDIT ? dueDate || undefined : undefined,
        amount_paid: purchaseType === PurchaseType.CASH ? total : amountPaid,
        discount: discount,
        notes: notes.trim() || undefined,
        items: rows.map((row) => ({
          description: row.description.trim(),
          quantity: Number(row.quantity),
          unit_type: "bag",
          weight_per_unit: Number(row.weight_per_unit ?? DEFAULT_BAG_WEIGHT_KG),
          total_weight: lineWeight(row),
          unit_price: Number(row.unit_price),
        })),
      }),
    onSuccess: () => {
      toast.success("Purchase invoice created");
      router.push("/dashboard/purchase-invoices");
    },
    onError: (err) => {
      const message = extractErrorMessage(err);
      setError(message);
      toast.error(message);
    },
  });

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }

  function addRow() {
    setRows((current) => [...current, newRow()]);
  }

  function addRowWithDescription(description: string) {
    setRows((current) => {
      const emptyRowIndex = current.findIndex(
        (row) =>
          !row.description.trim() &&
          Number(row.quantity) === 1 &&
          Number(row.weight_per_unit ?? DEFAULT_BAG_WEIGHT_KG) === DEFAULT_BAG_WEIGHT_KG &&
          Number(row.unit_price) === 0
      );

      if (emptyRowIndex >= 0) {
        return current.map((row, index) => (index === emptyRowIndex ? { ...row, description } : row));
      }

      return [...current, newRow(description)];
    });
  }

  function removeRow(rowId: string) {
    setRows((current) => {
      if (current.length === 1) return current;
      return current.filter((row) => row.id !== rowId);
    });
  }

  async function saveVendorItem() {
    const itemName = newVendorItem.trim();
    if (!vendorId || !itemName) return;

    setIsSavingItem(true);
    try {
      await vendorsService.addItem(vendorId, { item_name: itemName });
      await refetchVendorItems();
      setNewVendorItem("");
      addRowWithDescription(itemName);
    } finally {
      setIsSavingItem(false);
    }
  }

  function submit() {
    setError(null);
    if (!invoiceNumber.trim()) {
      setError("Enter an invoice number");
      toast.warning("Enter an invoice number");
      return;
    }
    if (!vendorId) {
      setError("Select a vendor");
      toast.warning("Select a vendor");
      return;
    }
    if (
      !rows.every(
        (row) =>
          row.description.trim() &&
          Number(row.quantity) > 0 &&
          Number(row.weight_per_unit || DEFAULT_BAG_WEIGHT_KG) > 0 &&
          Number(row.unit_price) > 0
      )
    ) {
      setError("Fill description, bags, kg per bag, and price for every item");
      toast.warning("Fill description, bags, kg per bag, and price for every item");
      return;
    }
    if (purchaseType === PurchaseType.CREDIT && amountPaid > total + MONEY_EPSILON) {
      setError("Paid amount cannot be greater than the total");
      toast.warning("Paid amount cannot be greater than the total");
      return;
    }
    createMutation.mutate();
  }

  return (
    <>
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      <Header
        title="New Purchase Invoice"
        actions={
          <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
            <Link href="/dashboard/purchase-invoices">
              <Button variant="ghost" size="sm" className="px-2 py-1.5 sm:px-3 sm:py-1.5">
                <ArrowLeft size={16} />
                <span className="hidden sm:inline"> Back</span>
              </Button>
            </Link>
          </div>
        }
      />
      <PageContainer>
        {error && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

        <Card>
          <CardHeader><h2 className="font-semibold text-gray-900">Invoice</h2></CardHeader>
          <CardBody className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <Input
              label="Invoice Number"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="0"
              required
            />
            <Select
              label="Vendor"
              value={vendorId}
              onChange={(e) => {
                setNewVendorItem("");
                setVendorId(e.target.value);
              }}
              options={(vendors?.items ?? []).map((v) => ({ value: v.id, label: `${v.name} - ${v.phone}` }))}
              placeholder="Select vendor"
              required
            />
            <Select
              label="Purchase Type"
              value={purchaseType}
              onChange={(e) => {
                const nextType = e.target.value as PurchaseType;
                setPurchaseType(nextType);
                if (nextType === PurchaseType.CASH) {
                  setDueDate("");
                  toast.info("Cash selected: due date disabled and cash amount set to the invoice total.");
                }
              }}
              options={[
                { value: PurchaseType.CASH, label: "Cash" },
                { value: PurchaseType.CREDIT, label: "Credit" },
              ]}
            />
            <Input
              label="Date"
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              required
            />
            <Input
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={purchaseType === PurchaseType.CASH}
              hint={purchaseType === PurchaseType.CASH ? "Cash purchase does not need a due date." : "Set a due date for credit purchases."}
            />
          </CardBody>
        </Card>

        {vendorId && (
          <Card>
            <CardHeader><h2 className="font-semibold text-gray-900">Vendor Items</h2></CardHeader>
            <CardBody>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Input
                    label="Add New Vendor Item"
                    value={newVendorItem}
                    onChange={(e) => setNewVendorItem(e.target.value)}
                    placeholder="Type and save an item name"
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={saveVendorItem}
                  disabled={!newVendorItem.trim()}
                  isLoading={isSavingItem}
                >
                  <Plus size={15} /> Save Item
                </Button>
              </div>
              {relatedItems.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {relatedItems.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => addRowWithDescription(item)}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                    >
                      + {item}
                    </button>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-gray-900">Items</h2>
            <Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={addRow}>
              <Plus size={15} /> Add Item
            </Button>
          </CardHeader>
          <CardBody className="space-y-4 lg:hidden">
            {rows.map((row, index) => {
              const weight = lineWeight(row);
              const amount = lineAmount(row);
              return (
                <div key={row.id} className="space-y-3 border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-gray-900">Item {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      disabled={rows.length === 1}
                      className="rounded p-1 text-gray-700 hover:bg-red-50 hover:text-red-700 disabled:text-gray-300 disabled:opacity-60"
                      aria-label="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                    Description
                    <Input
                      value={row.description}
                      onChange={(e) => updateRow(row.id, { description: e.target.value })}
                      list={vendorItemsListId}
                      placeholder={`Item ${index + 1}`}
                    />
                  </label>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      label="Bags"
                      type="number"
                      min="1"
                      step="1"
                      value={row.quantity}
                      onChange={(e) => updateRow(row.id, { quantity: Number(e.target.value || 0) })}
                      onMouseDown={(e) => { e.preventDefault(); (e.target as HTMLInputElement).select(); }}
                    />
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Kg / Bag</label>
                      <Input
                        type="number"
                        min="0"
                        step="0.001"
                        value={row.weight_per_unit ?? DEFAULT_BAG_WEIGHT_KG}
                        onChange={(e) => updateRow(row.id, { weight_per_unit: Number(e.target.value || 0) })}
                        onMouseDown={(e) => { e.preventDefault(); (e.target as HTMLInputElement).select(); }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                    <div>
                      <span className="block text-gray-500">Total Kg</span>
                      <span className="font-medium text-black">{weight.toFixed(3)}</span>
                    </div>
                    <div>
                      <label className="block text-gray-500">Price / Kg</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={row.unit_price}
                        onChange={(e) => updateRow(row.id, { unit_price: Number(e.target.value || 0) })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-right text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="text-right">
                      <span className="block text-gray-500">Amount</span>
                      <span className="font-semibold text-black">{formatCurrency(amount)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardBody>
          <div className="hidden overflow-x-auto lg:block">
            <table className="min-w-[1100px] table-fixed divide-y divide-gray-200 text-sm">
              <colgroup>
                <col className="w-[300px]" />
                <col className="w-[140px]" />
                <col className="w-[140px]" />
                <col className="w-[150px]" />
                <col className="w-[150px]" />
                <col className="w-[160px]" />
                <col className="w-[160px]" />
                <col className="w-[64px]" />
              </colgroup>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-black">Description</th>
                  <th className="px-4 py-3 text-right font-medium text-black">Bags</th>
                  <th className="px-4 py-3 text-left font-medium text-black">Unit</th>
                  <th className="px-4 py-3 text-right font-medium text-black">Kg/Bag</th>
                  <th className="px-4 py-3 text-right font-medium text-black">Total Kg</th>
                  <th className="px-4 py-3 text-right font-medium text-black">Price/Kg</th>
                  <th className="px-4 py-3 text-right font-medium text-black">Amount</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => {
                  const weight = lineWeight(row);
                  const amount = lineAmount(row);
                  return (
                    <tr key={row.id}>
                      <td className="px-4 py-3">
                        <Input
                          value={row.description}
                          onChange={(e) => updateRow(row.id, { description: e.target.value })}
                          list={vendorItemsListId}
                          className="..."
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={row.quantity}
                          onChange={(e) => updateRow(row.id, { quantity: Number(e.target.value || 0) })}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          title="Number of bags"
                        />
                      </td>
                      <td className="px-4 py-3 text-black">Bag</td>
                      <td className="px-4 py-3 text-right text-black">
                        <input
                          type="number"
                          min="0"
                          step="0.001"
                          value={row.weight_per_unit ?? DEFAULT_BAG_WEIGHT_KG}
                          onChange={(e) => updateRow(row.id, { weight_per_unit: Number(e.target.value || 0) })}
                          className="w-24 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-right text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          title="Kg per bag"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-black">{weight.toFixed(3)}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={row.unit_price}
                          onChange={(e) => updateRow(row.id, { unit_price: Number(e.target.value || 0) })}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-black">{formatCurrency(amount)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          disabled={rows.length === 1}
                          className="rounded p-1 text-gray-700 hover:bg-red-50 hover:text-red-700 disabled:text-gray-300 disabled:opacity-60"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <datalist id={vendorItemsListId}>
            {relatedItems.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><h2 className="font-semibold text-gray-900">Notes</h2></CardHeader>
            <CardBody>
              <div className="flex flex-col gap-1">
                <label htmlFor="purchase-invoice-notes" className="sr-only">
                  Notes
                </label>
                <textarea
                  id="purchase-invoice-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={8}
                  placeholder="Optional notes"
                  className="block w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader><h2 className="font-semibold text-gray-900">Totals</h2></CardHeader>
            <CardBody className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-black">Subtotal</span><span className="text-black">{formatCurrency(subtotal)}</span></div>
              <Input
                label="Discount"
                type="number"
                min="0"
                step="1"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value || 0))}
                onMouseDown={(e) => { e.preventDefault(); (e.target as HTMLInputElement).select(); }}
              />
              <div className="flex justify-between"><span className="text-black">Total</span><span className="font-semibold text-black">{formatCurrency(total)}</span></div>
              <Input
                label="Cash"
                type="number"
                min="0"
                step="1"
                value={amountPaid}
                onChange={(e) => setAmountPaid(Number(e.target.value))}
                onMouseDown={(e) => { e.preventDefault(); (e.target as HTMLInputElement).select(); }}
                disabled={purchaseType === PurchaseType.CASH}
                hint={purchaseType === PurchaseType.CASH ? "Cash purchase is automatically paid in full." : undefined}
              />
              {purchaseType === PurchaseType.CREDIT && (
                <div className="flex justify-between font-bold text-blue-700"><span>Credit / Remaining</span><span>{formatCurrency(remaining)}</span></div>
              )}
              <Button className="w-full" onClick={submit} isLoading={createMutation.isPending}>
                <Save size={16} /> Save Purchase Invoice
              </Button>
            </CardBody>
          </Card>
        </div>
      </PageContainer>
    </>
  );
}

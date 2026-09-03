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
import { customersService } from "@/services/customers.service";
import { salesInvoicesService } from "@/services/sales-invoices.service";
import { stockService } from "@/services/stock.service";
import { extractErrorMessage } from "@/services/api";
import { formatCurrency, getLocalDateString } from "@/utils/formatters";
import { formatSoldBreakdown } from "@/utils/invoice-pdf";
import { generateUUID } from "@/utils/uuid";
import { useToast } from "@/hooks/useToast";
import { InvoiceItemCreate, SaleType } from "@/types/invoice.types";

type Row = InvoiceItemCreate & { id: string };

const today = getLocalDateString();
const DEFAULT_BAG_WEIGHT_KG = 50;
const MONEY_EPSILON = 1;

function newRow(): Row {
  return {
    id: generateUUID(),
    description: "",
    quantity: 1,
    unit_type: "bag",
    unit_price: 0,
  };
}

function getBagWeightKg(
  row: Row,
  stockItems: { item_name: string; bag_weight_kg: number }[]
): number | null {
  if (!row.description.trim()) return null;
  const selectedItem = stockItems.find((item) => item.item_name === row.description);
  return selectedItem?.bag_weight_kg ?? DEFAULT_BAG_WEIGHT_KG;
}

function lineWeight(row: Row, stockItems: { item_name: string; bag_weight_kg: number }[]) {
  if (row.total_weight != null) return row.total_weight;
  const bagWeight = getBagWeightKg(row, stockItems);
  if (row.unit_type === "kg") return row.quantity;
  return row.quantity * (bagWeight ?? 0);
}

function lineAmount(row: Row, stockItems: { item_name: string; bag_weight_kg: number }[]) {
  return lineWeight(row, stockItems) * row.unit_price;
}

export default function NewSalesInvoicePage() {
  const router = useRouter();
  const toast = useToast();
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [saleType, setSaleType] = useState<SaleType>(SaleType.CASH);
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [amountPaid, setAmountPaid] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [error, setError] = useState<string | null>(null);
  const [customItemRows, setCustomItemRows] = useState<Set<string>>(new Set());

  const { data: customers } = useQuery({
    queryKey: ["customers", "invoice-select"],
    queryFn: () => customersService.list({ limit: 200 }),
  });

  const { data: stock } = useQuery({
    queryKey: ["stock", "invoice-select"],
    queryFn: () => stockService.list({ limit: 200 }),
  });

  const stockItems = useMemo(() => stock?.items ?? [], [stock?.items]);

  const subtotal = useMemo(
    () => rows.reduce((sum, row) => sum + lineAmount(row, stockItems), 0),
    [rows, stockItems]
  );
  const total = useMemo(
    () => Math.max(subtotal - discount, 0),
    [subtotal, discount]
  );
  const effectiveAmountPaid = saleType === SaleType.CASH ? total : amountPaid;
  const remaining = Math.max(total - effectiveAmountPaid, 0);

  const createMutation = useMutation({
    mutationFn: () =>
      salesInvoicesService.create({
        invoice_number: invoiceNumber.trim(),
        customer_id: customerId,
        sale_type: saleType,
        invoice_date: invoiceDate,
        due_date: saleType === SaleType.CREDIT ? dueDate || undefined : undefined,
        amount_paid: effectiveAmountPaid,
        discount: discount,
        notes: notes.trim() || undefined,
        items: rows.map((row) => ({
          description: row.description,
          quantity: row.quantity,
          unit_type: row.unit_type,
          weight_per_unit: getBagWeightKg(row, stockItems) ?? DEFAULT_BAG_WEIGHT_KG,
          total_weight: lineWeight(row, stockItems),
          unit_price: row.unit_price,
          is_custom: customItemRows.has(row.id),
        })),
      }),
    onSuccess: (invoice) => {
      router.push(`/dashboard/sales-invoices/${invoice.id}`);
    },
    onError: (e) => {
      const message = extractErrorMessage(e);
      setError(message);
      toast.error(message);
    },
  });

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }

  function removeRow(rowId: string) {
    setRows((current) => current.filter((item) => item.id !== rowId));
  }

  function isCustomItem(row: Row) {
    return customItemRows.has(row.id) || (row.description.trim() && !stockItems.some((item) => item.item_name === row.description));
  }

  function submit() {
    setError(null);
    if (!invoiceNumber.trim()) {
      setError("Enter invoice number");
      toast.warning("Enter invoice number");
      return;
    }
    if (!customerId) {
      setError("Select a customer");
      toast.warning("Select a customer");
      return;
    }
    if (!rows.every((row) => row.description.trim() && row.quantity > 0 && (isCustomItem(row) || getBagWeightKg(row, stockItems)) && row.unit_price > 0)) {
      setError("Fill item, quantity, and price for every row");
      toast.warning("Fill item, quantity, and price for every row");
      return;
    }
    if (effectiveAmountPaid > total) {
      setError("Cash paid cannot be greater than total");
      toast.warning("Cash paid cannot be greater than total");
      return;
    }
    if (saleType === SaleType.CASH && Math.abs(effectiveAmountPaid - total) > MONEY_EPSILON) {
      setError("Cash sale requires complete payment. Enter the full cash amount before saving.");
      toast.info("Cash sale is auto-paid with the full invoice total.");
      return;
    }
    createMutation.mutate();
  }

  return (
    <>
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      <Header
        title="New Sales Invoice"
        actions={
          <Link href="/dashboard/sales-invoices">
            <Button variant="ghost" size="sm" className="px-2 py-1.5 sm:px-3 sm:py-1.5">
              <ArrowLeft size={16} />
              <span className="hidden sm:inline"> Back</span>
            </Button>
          </Link>
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
              placeholder="01"
              required
            />
            <Select
              label="Customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              options={(customers?.items ?? []).map((c) => ({ value: c.id, label: `${c.name} - ${c.phone}` }))}
              placeholder="Select customer"
              required
            />
            <Input label="Date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required />
            <Input
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={saleType === SaleType.CASH}
              hint={saleType === SaleType.CASH ? "Cash invoices do not need a due date." : undefined}
            />
            <Select
              label="Sale Type"
              value={saleType}
              onChange={(e) => {
                const nextSaleType = e.target.value as SaleType;
                setSaleType(nextSaleType);
                if (nextSaleType === SaleType.CASH) {
                  setDueDate("");
                  toast.info("Cash selected: due date disabled and cash amount set to the invoice total.");
                }
              }}
              options={[
                { value: SaleType.CASH, label: "Cash" },
                { value: SaleType.CREDIT, label: "Credit" },
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-gray-900">Items</h2>
            <Button type="button" size="sm" variant="outline" className="w-full sm:w-auto" onClick={() => setRows((r) => [...r, newRow()])}>
              <Plus size={15} /> Add Item
            </Button>
          </CardHeader>
          <CardBody className="space-y-4 lg:hidden">
            {rows.map((row, index) => {
              const bagWeight = getBagWeightKg(row, stockItems);
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
                    Item
                    <select
                      value={customItemRows.has(row.id) ? "__other__" : row.description}
                      onChange={(e) => {
                        if (e.target.value === "__other__") {
                          setCustomItemRows((prev) => new Set(prev).add(row.id));
                          updateRow(row.id, { description: "" });
                        } else {
                          setCustomItemRows((prev) => {
                            const next = new Set(prev);
                            next.delete(row.id);
                            return next;
                          });
                          updateRow(row.id, { description: e.target.value });
                        }
                      }}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Select item</option>
                      {(stock?.items ?? []).map((item) => (
                        <option key={item.id} value={item.item_name}>
                          {item.item_name}
                        </option>
                      ))}
                      <option value="__other__">Other</option>
                    </select>
                    {customItemRows.has(row.id) && (
                      <Input
                        value={row.description}
                        onChange={(e) => updateRow(row.id, { description: e.target.value })}
                        onBlur={() => {
                          if (row.description.trim()) {
                            updateRow(row.id, { unit_type: "kg" });
                          }
                        }}
                        placeholder="Enter custom item name"
                      />
                    )}
                  </label>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Input
                      label={row.unit_type === "kg" ? "Kg" : "Bags"}
                      type="number"
                      min="0"
                      step={row.unit_type === "kg" ? "0.001" : "1"}
                      value={row.quantity}
                      onChange={(e) => updateRow(row.id, { quantity: Number(e.target.value) })}
                      onMouseDown={(e) => { e.preventDefault(); (e.target as HTMLInputElement).select(); }}
                    />
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Unit</label>
                      <select
                        value={row.unit_type}
                        onChange={(e) => updateRow(row.id, { unit_type: e.target.value })}
                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="bag">bags</option>
                        <option value="kg">kg</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Price / Kg</label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={row.unit_price}
                        onChange={(e) => updateRow(row.id, { unit_price: Number(e.target.value || 0) })}
                        onMouseDown={(e) => { e.preventDefault(); (e.target as HTMLInputElement).select(); }}
                      />
                    </div>
                  </div>

                  <div className={`grid grid-cols-1 gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm ${row.unit_type === "kg" ? "sm:grid-cols-3" : "sm:grid-cols-4 sm:gap-3"}`}>
                    <div>
                      <span className="block text-gray-500">{row.unit_type === "kg" ? "Kg" : "Qty"}</span>
                      <span className="font-medium text-black">
                        {row.unit_type === "kg"
                          ? lineWeight(row, stockItems).toFixed(3)
                          : lineWeight(row, stockItems)}
                      </span>
                    </div>
                    <div>
                      <span className="block text-gray-500">Kg / Bag</span>
                      <span className="font-medium text-black">{bagWeight ?? "—"}</span>
                    </div>
                    <div>
                      <span className="block text-gray-500">Total Kg</span>
                      <span className="font-medium text-black">{lineWeight(row, stockItems).toFixed(3)}</span>
                    </div>
                    <div className={row.unit_type === "kg" ? "text-right" : ""}>
                      <span className="block text-gray-500">Amount</span>
                      <span className="font-semibold text-black">{formatCurrency(lineAmount(row, stockItems))}</span>
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
                  <th className="px-4 py-3 text-left font-medium text-black">Item</th>
                  <th className="px-4 py-3 text-left font-medium text-black">Qty</th>
                  <th className="px-4 py-3 text-left font-medium text-black">Unit</th>
                  <th className="px-4 py-3 text-left font-medium text-black">Kg / Bag</th>
                  <th className="px-4 py-3 text-right font-medium text-black">Total Kg</th>
                  <th className="px-4 py-3 text-left font-medium text-black">Price/Kg</th>
                  <th className="px-4 py-3 text-right font-medium text-black">Amount</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row) => {
                  const bagWeight = getBagWeightKg(row, stockItems);
                  return (
                    <tr key={row.id}>
                      <td className="px-4 py-3">
                        {customItemRows.has(row.id) ? (
                          <Input
                            value={row.description}
                            onChange={(e) => updateRow(row.id, { description: e.target.value })}
                            onBlur={() => {
                              if (row.description.trim()) {
                                updateRow(row.id, { unit_type: "kg" });
                              }
                            }}
                            placeholder="Enter custom item name"
                          />
                        ) : (
                          <select
                            value={row.description}
                            onChange={(e) => {
                              if (e.target.value === "__other__") {
                                setCustomItemRows((prev) => new Set(prev).add(row.id));
                                updateRow(row.id, { description: "" });
                              } else {
                                setCustomItemRows((prev) => {
                                  const next = new Set(prev);
                                  next.delete(row.id);
                                  return next;
                                });
                                updateRow(row.id, { description: e.target.value });
                              }
                            }}
                            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">Select item</option>
                            {(stock?.items ?? []).map((item) => (
                              <option key={item.id} value={item.item_name}>
                                {item.item_name}
                              </option>
                            ))}
                            <option value="__other__">Other</option>
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          step={row.unit_type === "kg" ? "0.001" : "1"}
                          value={row.quantity}
                          onChange={(e) => updateRow(row.id, { quantity: Number(e.target.value) })}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          title={row.unit_type === "kg" ? "Kg sold" : "Number of bags"}
                        />
                      </td>
                      <td className="px-4 py-3 text-black">
                        <select
                          value={row.unit_type}
                          onChange={(e) => updateRow(row.id, { unit_type: e.target.value })}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="bag">bags</option>
                          <option value="kg">kg</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-right text-black">
                        {bagWeight ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-black">
                        {row.unit_type === "kg"
                          ? lineWeight(row, stockItems).toFixed(3)
                          : lineWeight(row, stockItems)}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={row.unit_price}
                          onChange={(e) => updateRow(row.id, { unit_price: Number(e.target.value) })}
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-right text-sm text-black focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-black">{formatCurrency(lineAmount(row, stockItems))}</td>
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
        </Card>

        {/* Notes (left) + Totals (right) column layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><h2 className="font-semibold text-gray-900">Notes</h2></CardHeader>
            <CardBody>
              <div className="flex flex-col gap-1">
                <label htmlFor="sales-invoice-notes" className="sr-only">
                  Notes
                </label>
                <textarea
                  id="sales-invoice-notes"
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
                value={effectiveAmountPaid}
                onChange={(e) => setAmountPaid(Number(e.target.value))}
                onMouseDown={(e) => { e.preventDefault(); (e.target as HTMLInputElement).select(); }}
                disabled={saleType === SaleType.CASH}
                hint={saleType === SaleType.CASH ? "Cash sale is automatically paid in full." : undefined}
              />
              {saleType === SaleType.CREDIT && (
                <div className="flex justify-between font-bold text-blue-700"><span>Credit / Remaining</span><span>{formatCurrency(remaining)}</span></div>
              )}
              <Button className="w-full" onClick={submit} isLoading={createMutation.isPending}>
                <Save size={16} /> Save Invoice
              </Button>
            </CardBody>
          </Card>
        </div>
      </PageContainer>
    </>
  );
}

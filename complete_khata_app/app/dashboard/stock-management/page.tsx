"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Package, AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/Card";
import { Pagination, Table } from "@/components/ui/Table";
import { SearchField } from "@/components/ui/SearchField";
import { Modal } from "@/components/ui/Modal";
import { DeleteModal } from "@/components/ui/DeleteModal";
import { Input } from "@/components/ui/Input";
import { stockService } from "@/services/stock.service";
import { useToast } from "@/hooks/useToast";
import type { StockItem } from "@/types/stock.types";

const LOW_STOCK_KG = 100;
const LIMIT = 20;
const DEFAULT_BAG_WEIGHT_KG = 50;

function formatKg(value: number) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 3 })} kg`;
}

function getBagWeightKg(stock: StockItem) {
  return Number(stock.bag_weight_kg ?? DEFAULT_BAG_WEIGHT_KG);
}

function formatBags(stock: StockItem) {
  const bagWeightKg = getBagWeightKg(stock);
  const bags = bagWeightKg > 0 ? Number(stock.quantity_kg) / bagWeightKg : 0;
  return `${bags.toLocaleString(undefined, { maximumFractionDigits: 2 })} bags`;
}

export default function StockManagementPage() {
  const [skip, setSkip] = useState(0);
  const [search, setSearch] = useState("");
  const [returnItem, setReturnItem] = useState<StockItem | null>(null);
  const [bagCount, setBagCount] = useState("");
  const [isReturning, setIsReturning] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StockItem | null>(null);
  const deleteMutation = useMutation({
    mutationFn: stockService.delete,
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["stock"] });
    },
  });
  const queryClient = useQueryClient();
  const toast = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["stock", skip, search],
    queryFn: () => stockService.list({ skip, limit: LIMIT, search: search || undefined }),
  });

  const rows = data?.items ?? [];
  const totalStock = rows.reduce((sum, row) => sum + Number(row.quantity_kg), 0);
  const lowStockCount = rows.filter((row) => Number(row.quantity_kg) <= LOW_STOCK_KG).length;

  const columns = [
    { header: "Item", accessor: (row: StockItem) => <span className="font-medium text-gray-900">{row.item_name}</span> },
    {
      header: "Available",
      accessor: (row: StockItem) => (
        <span className={Number(row.quantity_kg) <= LOW_STOCK_KG ? "font-semibold text-red-600" : "font-semibold text-green-700"}>
          {formatKg(Number(row.quantity_kg))}
        </span>
      ),
      className: "text-right",
    },
    { header: "No. of Bags", accessor: (row: StockItem) => formatBags(row), className: "text-right" },
    { header: "Kg per Bag", accessor: (row: StockItem) => formatKg(getBagWeightKg(row)), className: "text-right" },
    {
      header: "Actions",
      accessor: (row: StockItem) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => openReturnModal(row)}>
            <RotateCcw size={16} /> Return
          </Button>
          <Button size="sm" variant="danger" onClick={() => setDeleteTarget(row)} aria-label="Delete stock" title="Delete">
            <Trash2 size={16} />
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  const handleReturnBags = async () => {
    if (!returnItem) return;
    const count = Number(bagCount);
    if (!Number.isFinite(count) || count <= 0) {
      toast.error("Enter a valid bag count");
      return;
    }
    setIsReturning(true);
    try {
      await stockService.returnBags({
        item_name: returnItem.item_name,
        bag_count: count,
      });
      toast.success(`${count} bag(s) returned for ${returnItem.item_name}`);
      closeReturnModal();
      queryClient.invalidateQueries({ queryKey: ["stock"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to return bags");
    } finally {
      setIsReturning(false);
    }
  };

  const closeReturnModal = () => {
    setReturnItem(null);
    setBagCount("");
  };

  const openReturnModal = (row: StockItem) => {
    setReturnItem(row);
    setBagCount("");
  };

  return (
    <>
      <Header
        title="Stock Management"
        actions={
          <Link href="/dashboard/sales-invoices/new">
            <Button size="sm" variant="secondary" className="px-2 py-1.5 sm:px-3 sm:py-1.5">
              <FileText size={16} />
              <span className="hidden sm:inline"> Sale</span>
            </Button>
          </Link>
        }
      />
      <PageContainer>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label="Stock Items" value={data?.total ?? 0} icon={<Package size={22} />} color="blue" />
          <StatCard label="Available Stock" value={formatKg(totalStock)} icon={<Package size={22} />} color="green" />
          <StatCard label="Low Stock Items" value={lowStockCount} icon={<AlertTriangle size={22} />} color="red" />
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-semibold text-gray-900">Inventory</h2>
            <SearchField
              value={search}
              onChange={(value) => {
                setSearch(value);
                setSkip(0);
              }}
              placeholder="Search stock..."
              className="w-full sm:w-72"
            />
          </CardHeader>
          <CardBody>
            <Table
              columns={columns}
              data={rows}
              keyExtractor={(row) => row.id}
              isLoading={isLoading}
              emptyMessage="No stock items found"
            />
            {data && data.total > LIMIT && <Pagination total={data.total} skip={skip} limit={LIMIT} onPageChange={setSkip} />}
          </CardBody>
        </Card>
      </PageContainer>

      <Modal isOpen={!!returnItem} onClose={closeReturnModal} title="Return Bags" size="sm">
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-gray-600">Item</p>
            <p className="font-medium text-gray-900">{returnItem?.item_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Current Bag Weight</p>
            <p className="font-medium text-gray-900">{returnItem ? formatKg(getBagWeightKg(returnItem)) : "—"}</p>
          </div>
          <Input
            label="Bags Returned"
            type="number"
            min="0"
            step="any"
            value={bagCount}
            onChange={(e) => setBagCount(e.target.value)}
            placeholder="Enter number of bags"
            required
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeReturnModal} disabled={isReturning}>Cancel</Button>
            <Button onClick={handleReturnBags} isLoading={isReturning}>Return Bags</Button>
          </div>
        </div>
      </Modal>
      <DeleteModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
        isLoading={deleteMutation.isPending}
        title="Delete Stock Item"
        message={`Are you sure you want to delete "${deleteTarget?.item_name?.trim() || "this stock item"}"? This action cannot be undone.`}
      />
    </>
  );
}

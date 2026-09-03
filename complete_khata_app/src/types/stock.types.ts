export interface StockItem {
  id: string;
  item_name: string;
  quantity_kg: number;
  bag_weight_kg: number;
  created_at: string;
  updated_at: string;
}

export interface StockCreate {
  item_name: string;
  quantity_kg: number;
  bag_weight_kg: number;
}

export interface StockUpdate {
  item_name?: string;
  quantity_kg?: number;
  bag_weight_kg?: number;
}

export interface StockListResponse {
  message: string;
  total: number;
  items: StockItem[];
}

export interface BagReturnRequest {
  item_name: string;
  bag_count: number;
}

export interface BagReturnResponse {
  message: string;
  stock: StockItem;
  returned_bags: number;
}

export interface StockSuccessResponse {
  message: string;
  stock: StockItem;
}

export interface StockDeleteResponse {
  message: string;
}

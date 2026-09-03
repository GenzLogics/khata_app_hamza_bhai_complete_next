export interface PaginationParams {
  skip?: number;
  limit?: number;
  search?: string;
}

export interface ListResponse<T> {
  total: number;
  items: T[];
}

export interface ApiError {
  detail: string;
}

export type SortDirection = "asc" | "desc";

export interface SelectOption {
  value: string;
  label: string;
}

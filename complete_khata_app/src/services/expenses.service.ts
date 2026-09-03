import { apiClient } from "./api";
import type {
  Expense,
  ExpenseCreate,
  ExpenseListResponse,
  ExpenseSummary,
  ExpenseUpdate,
  HeadingOperationResponse,
} from "@/types/expense.types";

export const expensesService = {
  async list(params?: {
    skip?: number;
    limit?: number;
    from_date?: string;
    to_date?: string;
  }): Promise<ExpenseListResponse> {
    const res = await apiClient.get<ExpenseListResponse>("/expenses/", { params });
    return res.data;
  },

  async getSummary(params?: { from_date?: string; to_date?: string }): Promise<ExpenseSummary> {
    const res = await apiClient.get<ExpenseSummary>("/expenses/summary", { params });
    return res.data;
  },

  async getById(id: string): Promise<Expense> {
    const res = await apiClient.get<Expense>(`/expenses/${id}`);
    return res.data;
  },

  async create(data: ExpenseCreate): Promise<Expense> {
    const res = await apiClient.post<Expense>("/expenses/", data);
    return res.data;
  },

  async update(id: string, data: ExpenseUpdate): Promise<Expense> {
    const res = await apiClient.put<Expense>(`/expenses/${id}`, data);
    return res.data;
  },

  async delete(id: string): Promise<void> {
    await apiClient.delete(`/expenses/${id}`);
  },

  async renameHeading(
    oldHeading: string,
    newHeading: string,
  ): Promise<HeadingOperationResponse> {
    const res = await apiClient.patch<HeadingOperationResponse>(
      `/expenses/headings/${encodeURIComponent(oldHeading)}`,
      { new_heading: newHeading },
    );
    return res.data;
  },

  async deleteHeading(heading: string): Promise<HeadingOperationResponse> {
    const res = await apiClient.delete<HeadingOperationResponse>(
      `/expenses/headings/${encodeURIComponent(heading)}`,
    );
    return res.data;
  },
};

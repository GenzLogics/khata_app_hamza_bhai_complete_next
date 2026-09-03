import { apiClient } from "./api";
import type { RemindersResponse } from "@/types/reminder.types";

export const remindersService = {
  async getReminders(): Promise<RemindersResponse> {
    const res = await apiClient.get<RemindersResponse>("/reminders/");
    return res.data;
  },
};

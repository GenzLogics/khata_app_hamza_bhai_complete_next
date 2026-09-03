"use client";

import { useState, useCallback } from "react";
import { generateUUID } from "@/utils/uuid";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 6000,
  error:   6000,
  warning: 6000,
  info:    6000,
};

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration?: number) => {
    const id = generateUUID();
    const d = duration ?? DEFAULT_DURATION[type];
    setToasts((prev) => [...prev, { id, type, message, duration: d }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, d);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return {
    toasts,
    success: (msg: string, duration?: number) => addToast("success", msg, duration),
    error:   (msg: string, duration?: number) => addToast("error",   msg, duration),
    warning: (msg: string, duration?: number) => addToast("warning", msg, duration),
    info:    (msg: string, duration?: number) => addToast("info",    msg, duration),
    removeToast,
  };
}

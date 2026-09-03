"use client";

import { useEffect, useState } from "react";
import type { Toast, ToastType } from "@/hooks/useToast";

const CONFIG: Record<ToastType, { icon: string; bg: string; iconBg: string; close: string }> = {
  success: {
    icon: "✓",
    bg: "bg-green-600 text-white",
    iconBg: "bg-green-500 text-white",
    close: "text-green-200 hover:text-white",
  },
  error: {
    icon: "✕",
    bg: "bg-red-600 text-white",
    iconBg: "bg-red-500 text-white",
    close: "text-red-200 hover:text-white",
  },
  warning: {
    icon: "⚠",
    bg: "bg-yellow-500 text-white",
    iconBg: "bg-yellow-400 text-white",
    close: "text-yellow-100 hover:text-white",
  },
  info: {
    icon: "ℹ",
    bg: "bg-blue-600 text-white",
    iconBg: "bg-blue-500 text-white",
    close: "text-blue-200 hover:text-white",
  },
};

const ANIM = 150;

function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast;
  onRemove: (id: string) => void;
}) {
  const [phase, setPhase] = useState<"enter" | "show" | "exit">("enter");
  const cfg = CONFIG[toast.type];

  useEffect(() => {
    const enterTimer = setTimeout(() => setPhase("show"), 40);
    const exitTimer = setTimeout(() => setPhase("exit"), toast.duration - ANIM);
    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
    };
  }, []);

  function dismiss() {
    setPhase("exit");
    setTimeout(() => onRemove(toast.id), ANIM);
  }

  const isHidden = phase === "enter" || phase === "exit";

  return (
    <div
      className={`flex w-full items-start gap-3 rounded-2xl px-4 py-4 shadow-2xl sm:w-96 sm:px-5
        transition-all ease-out
        ${isHidden ? "opacity-0 translate-x-12 scale-95" : "opacity-100 translate-x-0 scale-100"}
        ${cfg.bg}`}
      style={{ transitionDuration: `${ANIM}ms` }}
    >
      <span
        className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${cfg.iconBg}`}
      >
        {cfg.icon}
      </span>
      <p className="flex-1 text-sm font-semibold leading-snug">{toast.message}</p>
      <button
        onClick={dismiss}
        className={`ml-1 flex-shrink-0 text-xl leading-none transition-colors ${cfg.close}`}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}

export function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Toast[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed left-3 right-3 top-3 z-[9999] flex flex-col gap-3 sm:left-auto sm:right-5 sm:top-5 sm:w-96">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
}

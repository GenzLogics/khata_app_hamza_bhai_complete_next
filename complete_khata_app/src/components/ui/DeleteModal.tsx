"use client";

import { TriangleAlert } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
  title?: string;
  message?: string;
  itemName?: string;
}

export function DeleteModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  title = "Delete Confirmation",
  message,
  itemName,
}: DeleteModalProps) {
  const displayMessage =
    message ??
    (itemName
      ? `Are you sure you want to permanently delete "${itemName}"? This action cannot be undone.`
      : "Are you sure you want to permanently delete this record? This action cannot be undone.");

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="flex flex-col items-center text-center px-2 pb-2">
        {/* Icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-4">
          <TriangleAlert size={32} className="text-red-600" />
        </div>

        {/* Title */}
        <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>

        {/* Message */}
        <p className="text-sm text-gray-500 leading-relaxed mb-6">{displayMessage}</p>

        {/* Actions */}
        <div className="flex w-full gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="flex-1"
            disabled={isLoading}
          >
            Cancel
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Deleting...
              </span>
            ) : (
              "Delete"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

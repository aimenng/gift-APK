import React, { useCallback, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  confirmTone?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  confirmTone = 'primary',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        onCancel();
      }
    },
    [loading, onCancel]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, isOpen]);

  if (!isOpen) return null;

  const confirmButtonClass =
    confirmTone === 'danger'
      ? 'bg-red-500 hover:bg-red-600 focus-visible:ring-red-200'
      : 'bg-primary hover:bg-[#7a8a4b] focus-visible:ring-primary/25';

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={loading ? undefined : onCancel}
        aria-label="关闭确认弹窗"
      />

      <div className="relative w-full max-w-sm rounded-3xl border border-[var(--eye-border)] bg-[var(--eye-bg-primary)] p-5 shadow-2xl animate-scale-up">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-2xl bg-amber-100 p-2.5 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-[var(--eye-text-primary)]">{title}</h3>
            {description && <p className="mt-1 text-sm leading-relaxed text-[var(--eye-text-secondary)]">{description}</p>}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="h-11 rounded-xl border border-[var(--eye-border)] bg-[var(--eye-bg-secondary)] font-semibold text-[var(--eye-text-primary)] transition-colors hover:bg-black/5 disabled:opacity-60"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`h-11 rounded-xl font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-4 disabled:opacity-60 ${confirmButtonClass}`}
          >
            {loading ? '处理中...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

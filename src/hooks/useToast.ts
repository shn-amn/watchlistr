import { useState, useCallback } from 'react';
import type { ToastNotification } from '../types';

export function useToast() {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((toast: Omit<ToastNotification, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newToast: ToastNotification = { ...toast, id };

    setToasts(prev => [...prev, newToast]);

    // Auto-dismiss after 8s if there are no interactive action buttons
    if (!toast.onRetry && !toast.onRollback) {
      setTimeout(() => {
        removeToast(id);
      }, 8000);
    }

    return id;
  }, [removeToast]);

  return {
    toasts,
    showToast,
    removeToast
  };
}

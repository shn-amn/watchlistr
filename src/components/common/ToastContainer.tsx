import React from 'react';
import { AlertCircle, CheckCircle, Info, RefreshCw, Undo2, X } from 'lucide-react';
import type { ToastNotification } from '../../types';

interface ToastContainerProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxWidth: '420px',
        width: 'calc(100% - 48px)',
        pointerEvents: 'none'
      }}
    >
      {toasts.map(toast => {
        const isError = toast.type === 'error';
        const isSuccess = toast.type === 'success';

        return (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-primary)',
              border: `1px solid ${isError ? 'rgba(239, 68, 68, 0.4)' : isSuccess ? 'rgba(34, 197, 94, 0.4)' : 'var(--border-color)'}`,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{ marginTop: '2px', color: isError ? '#ef4444' : isSuccess ? '#22c55e' : 'var(--accent-color)' }}>
                {isError ? <AlertCircle size={18} /> : isSuccess ? <CheckCircle size={18} /> : <Info size={18} />}
              </div>
              <div style={{ flex: 1, fontSize: '0.875rem', lineHeight: '1.4', wordBreak: 'break-word', color: 'var(--text-primary)' }}>
                {toast.message}
              </div>
              <button
                onClick={() => onDismiss(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Dismiss"
              >
                <X size={16} />
              </button>
            </div>

            {(toast.onRetry || toast.onRollback) && (
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                {toast.onRollback && (
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => {
                      toast.onRollback?.();
                      onDismiss(toast.id);
                    }}
                    style={{ fontSize: '0.8rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Undo2 size={13} /> Rollback
                  </button>
                )}
                {toast.onRetry && (
                  <button
                    className="btn btn-primary btn-small"
                    onClick={() => {
                      toast.onRetry?.();
                      onDismiss(toast.id);
                    }}
                    style={{ fontSize: '0.8rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <RefreshCw size={13} /> Retry
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

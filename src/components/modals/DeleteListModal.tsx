import React from 'react';
import { Trash2, X } from 'lucide-react';
import type { MediaList } from '../../types';

interface DeleteListModalProps {
  isOpen: boolean;
  list: MediaList | null;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteListModal: React.FC<DeleteListModalProps> = ({
  isOpen,
  list,
  onClose,
  onConfirm
}) => {
  if (!isOpen || !list) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h3 className="modal-title" style={{ margin: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trash2 size={18} /> Delete List
          </h3>
          <button className="btn btn-action-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '1.25rem 0 0.5rem 0' }}>
          <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: '1.5' }}>
            Are you sure you want to delete <strong>"{list.title}"</strong>?
          </p>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            This action will permanently remove the list and publish a deletion request to Nostr relays. This cannot be undone.
          </p>
        </div>

        <div className="modal-actions-bar" style={{ marginTop: '1.25rem' }}>
          <button
            type="button"
            className="btn"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ backgroundColor: '#ef4444', borderColor: '#ef4444', color: '#ffffff' }}
            onClick={onConfirm}
          >
            <Trash2 size={16} /> Delete Permanently
          </button>
        </div>
      </div>
    </div>
  );
};

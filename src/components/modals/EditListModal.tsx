import React from 'react';
import { Check, X } from 'lucide-react';
import type { MediaList } from '../../types';

interface EditListModalProps {
  isOpen: boolean;
  list: MediaList | null;
  formData: { title: string; description: string };
  setFormData: React.Dispatch<React.SetStateAction<{ title: string; description: string }>>;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
}

export const EditListModal: React.FC<EditListModalProps> = ({
  isOpen,
  list,
  formData,
  setFormData,
  onClose,
  onSave
}) => {
  if (!isOpen || !list) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h3 className="modal-title" style={{ margin: 0 }}>Edit List Details</h3>
          <button className="btn btn-action-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.25rem' }}>
          <div className="modal-field">
            <label className="modal-label">List Title *</label>
            <input
              type="text"
              className="input-field"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
              autoFocus
            />
          </div>

          <div className="modal-field">
            <label className="modal-label">Description (Optional)</label>
            <textarea
              className="input-field"
              placeholder="Provide a brief description for this list..."
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="modal-actions-bar">
            <button
              type="button"
              className="btn"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              <Check size={16} /> Save & Publish
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

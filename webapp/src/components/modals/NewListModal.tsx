import React from 'react';
import { X } from 'lucide-react';

interface NewListModalProps {
  isOpen: boolean;
  type: 'watchlist' | 'watched';
  setType: (type: 'watchlist' | 'watched') => void;
  formData: { title: string; description: string };
  setFormData: React.Dispatch<React.SetStateAction<{ title: string; description: string }>>;
  onClose: () => void;
  onCreate: (e: React.FormEvent) => void;
}

export const NewListModal: React.FC<NewListModalProps> = ({
  isOpen,
  type,
  setType,
  formData,
  setFormData,
  onClose,
  onCreate
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h3 className="modal-title" style={{ margin: 0 }}>
            Create New List
          </h3>
          <button
            className="btn btn-action-icon"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={onCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1.25rem' }}>
          <div className="modal-field">
            <label className="modal-label">List Type</label>
            <div style={{ display: 'flex', gap: '6px', padding: '4px', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid #eaeaea' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setType('watched')}
                style={{
                  flex: 1,
                  border: 'none',
                  backgroundColor: type === 'watched' ? 'var(--accent-color)' : 'transparent',
                  color: type === 'watched' ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: type === 'watched' ? 700 : 500,
                  boxShadow: type === 'watched' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all var(--transition-fast)'
                }}
              >
                Watched
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setType('watchlist')}
                style={{
                  flex: 1,
                  border: 'none',
                  backgroundColor: type === 'watchlist' ? 'var(--accent-color)' : 'transparent',
                  color: type === 'watchlist' ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: type === 'watchlist' ? 700 : 500,
                  boxShadow: type === 'watchlist' ? 'var(--shadow-sm)' : 'none',
                  transition: 'all var(--transition-fast)'
                }}
              >
                To Watch
              </button>
            </div>
          </div>

          <div className="modal-field">
            <label className="modal-label">List Title *</label>
            <input
              type="text"
              className="input-field"
              placeholder={type === 'watched' ? "e.g., Summer 2026 Horror Movies" : "e.g., Sci-Fi Favorites To Watch"}
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
              Create & Publish List
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

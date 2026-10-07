import React from 'react';
import { UserPlus, X } from 'lucide-react';

interface FollowModalProps {
  isOpen: boolean;
  inputKey: string;
  setInputKey: (val: string) => void;
  error: string | null;
  onClose: () => void;
  onFollow: (key: string) => void;
}

export const FollowModal: React.FC<FollowModalProps> = ({
  isOpen,
  inputKey,
  setInputKey,
  error,
  onClose,
  onFollow
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h3 className="modal-title" style={{ margin: 0 }}>Follow Nostr Contact</h3>
          <button className="btn btn-action-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onFollow(inputKey);
          }}
          style={{ marginTop: '1rem' }}
        >
          <div className="modal-field">
            <label className="modal-label">Nostr Public Key (npub1... or 64-char Hex) *</label>
            <input
              type="text"
              className="input-field"
              placeholder="npub1..."
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              required
              autoFocus
            />
            {error && (
              <span style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '0.4rem', display: 'block' }}>
                {error}
              </span>
            )}
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0 1rem 0' }}>
            Following a profile adds their <code>p</code> tag to your <code>kind:10016</code> media follow list on Nostr, allowing you to discover their <code>kind:30016</code> logs.
          </p>

          <div className="modal-actions-bar">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <UserPlus size={16} /> Follow Profile
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

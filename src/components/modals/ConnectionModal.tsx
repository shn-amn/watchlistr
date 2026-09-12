import React from 'react';
import { Copy, LogOut, RefreshCw, Upload, X } from 'lucide-react';
import type { NostrUser } from '../../types';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  nostrUser: NostrUser | null;
  profileEditName: string;
  setProfileEditName: (name: string) => void;
  profileEditPicture: string;
  setProfileEditPicture: (pic: string) => void;
  selectedImageFile: File | null;
  setSelectedImageFile: (f: File | null) => void;
  cropZoom: number;
  setCropZoom: (z: number) => void;
  cropOffset: { x: number; y: number };
  setCropOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  isDraggingPhoto: boolean;
  setIsDraggingPhoto: (d: boolean) => void;
  dragStartRef: React.MutableRefObject<{ x: number; y: number }>;
  isDraggingAvatar: boolean;
  setIsDraggingAvatar: (d: boolean) => void;
  isPublishingProfile: boolean;
  publishingStep: 'uploading' | 'publishing' | null;
  profileStatus: { type: 'success' | 'error'; message: string } | null;
  setProfileStatus: (s: { type: 'success' | 'error'; message: string } | null) => void;
  handleFileSelection: (f: File) => void;
  handlePublishProfile: (e: React.FormEvent) => void;
  logoutNostr: () => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({
  isOpen,
  onClose,
  nostrUser,
  profileEditName,
  setProfileEditName,
  profileEditPicture,
  setProfileEditPicture,
  selectedImageFile,
  setSelectedImageFile,
  cropZoom,
  setCropZoom,
  cropOffset,
  setCropOffset,
  isDraggingPhoto,
  setIsDraggingPhoto,
  dragStartRef,
  isDraggingAvatar,
  setIsDraggingAvatar,
  isPublishingProfile,
  publishingStep,
  profileStatus,
  setProfileStatus,
  handleFileSelection,
  handlePublishProfile,
  logoutNostr
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '460px' }}>
        <div className="modal-header">
          <h3 className="modal-title" style={{ margin: 0, fontSize: '1.25rem' }}>Account & Profile</h3>
          <button className="btn btn-action-icon" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Profile Setup Form */}
          <form onSubmit={handlePublishProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Nostr Profile
            </div>

            {/* Avatar Drag & Drop & Crop Dropzone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDraggingAvatar(true); }}
              onDragLeave={() => setIsDraggingAvatar(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDraggingAvatar(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileSelection(e.dataTransfer.files[0]);
                }
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
                border: isDraggingAvatar ? '2px dashed var(--accent-color)' : '1px dashed var(--border-color)',
                backgroundColor: isDraggingAvatar ? 'var(--accent-color-light)' : 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                gap: '0.75rem',
                textAlign: 'center',
                transition: 'all var(--transition-fast)'
              }}
            >
              {/* Interactive Crop / Preview Frame */}
              {selectedImageFile ? (
                <div
                  style={{
                    width: '120px',
                    height: '120px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    position: 'relative',
                    border: '3px solid var(--accent-color)',
                    cursor: isDraggingPhoto ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    touchAction: 'none'
                  }}
                  onMouseDown={(e) => {
                    setIsDraggingPhoto(true);
                    dragStartRef.current = { x: e.clientX - cropOffset.x, y: e.clientY - cropOffset.y };
                  }}
                  onMouseMove={(e) => {
                    if (!isDraggingPhoto) return;
                    setCropOffset({
                      x: e.clientX - dragStartRef.current.x,
                      y: e.clientY - dragStartRef.current.y
                    });
                  }}
                  onMouseUp={() => setIsDraggingPhoto(false)}
                  onMouseLeave={() => setIsDraggingPhoto(false)}
                  onTouchStart={(e) => {
                    if (e.touches[0]) {
                      setIsDraggingPhoto(true);
                      dragStartRef.current = { x: e.touches[0].clientX - cropOffset.x, y: e.touches[0].clientY - cropOffset.y };
                    }
                  }}
                  onTouchMove={(e) => {
                    if (isDraggingPhoto && e.touches[0]) {
                      setCropOffset({
                        x: e.touches[0].clientX - dragStartRef.current.x,
                        y: e.touches[0].clientY - dragStartRef.current.y
                      });
                    }
                  }}
                  onTouchEnd={() => setIsDraggingPhoto(false)}
                >
                  <img
                    src={profileEditPicture}
                    alt="Avatar Crop Preview"
                    draggable={false}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: `translate(${cropOffset.x}px, ${cropOffset.y}px) scale(${cropZoom})`,
                      transformOrigin: 'center',
                      pointerEvents: 'none'
                    }}
                  />
                </div>
              ) : profileEditPicture ? (
                <img
                  src={profileEditPicture}
                  alt="Avatar Preview"
                  style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-color)' }}
                />
              ) : (
                <div className="profile-avatar-fallback" style={{ width: '64px', height: '64px', fontSize: '1.75rem' }}>
                  {(profileEditName || nostrUser?.name || 'A').substring(0, 1).toUpperCase()}
                </div>
              )}

              {/* Interactive Crop Controls or File Picker */}
              {selectedImageFile ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', maxWidth: '220px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Zoom</span>
                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="0.05"
                      value={cropZoom}
                      onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                      style={{ flex: 1, accentColor: 'var(--accent-color)' }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                      {cropZoom.toFixed(1)}x
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-color)', fontWeight: 600 }}>
                    Drag photo to center • Use slider to zoom
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                  <label className="btn btn-small btn-primary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Upload size={14} /> Choose Photo
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isPublishingProfile || nostrUser?.readOnly}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileSelection(e.target.files[0]);
                        }
                      }}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    Drag & drop image here or choose photo
                  </span>
                </div>
              )}
            </div>

            {/* Name Input */}
            <div className="modal-field">
              <label className="modal-label">Display Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Satoshi"
                value={profileEditName}
                onChange={(e) => setProfileEditName(e.target.value)}
                disabled={isPublishingProfile || nostrUser?.readOnly}
                required
              />
            </div>

            {/* Picture URL Input */}
            <div className="modal-field">
              <label className="modal-label">Profile Picture URL</label>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '0.25rem' }}>
                <input
                  type="url"
                  className="input-field"
                  placeholder="https://nostr.build/i/..."
                  value={profileEditPicture}
                  onChange={(e) => {
                    setProfileEditPicture(e.target.value);
                    setSelectedImageFile(null);
                  }}
                  disabled={isPublishingProfile || nostrUser?.readOnly}
                  style={{ flex: 1 }}
                />
                {profileEditPicture && (
                  <button
                    type="button"
                    className="btn btn-action-icon"
                    onClick={() => {
                      navigator.clipboard.writeText(profileEditPicture);
                      setProfileStatus({ type: 'success', message: 'Profile picture URL copied to clipboard!' });
                    }}
                    title="Copy image URL"
                  >
                    <Copy size={16} />
                  </button>
                )}
              </div>
            </div>

            {profileStatus && (
              <div style={{
                fontSize: '0.85rem',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: profileStatus.type === 'success' ? 'rgba(21, 128, 61, 0.12)' : 'rgba(239, 68, 68, 0.1)',
                color: profileStatus.type === 'success' ? '#15803d' : '#ef4444',
                border: `1px solid ${profileStatus.type === 'success' ? 'rgba(21, 128, 61, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
              }}>
                {profileStatus.message}
              </div>
            )}

            {nostrUser?.readOnly ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                Connected in Read-Only mode. Sign in with Extension or Bunker to edit profile.
              </div>
            ) : (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isPublishingProfile}
                style={{ width: '100%', justifyContent: 'center', padding: '0.65rem' }}
              >
                {isPublishingProfile ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    <RefreshCw size={16} className="spin" />
                    {publishingStep === 'uploading'
                      ? 'Uploading Photo (check bunker)...'
                      : 'Publishing Profile (check bunker)...'}
                  </span>
                ) : (
                  'Save Profile'
                )}
              </button>
            )}
          </form>

          {/* Connection Type & Public Key Details */}
          <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Connection Type</span>
              <div>
                {nostrUser?.signerType === 'bunker' && <span className="bunker-badge" style={{ margin: 0 }}>NIP-46 Remote Signer</span>}
                {nostrUser?.signerType === 'extension' && <span className="bunker-badge" style={{ backgroundColor: 'var(--accent-color)', color: '#fff', margin: 0 }}>Extension (NIP-07)</span>}
                {nostrUser?.readOnly && <span className="read-only-badge" style={{ margin: 0 }}>Read-Only Mode</span>}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.25rem' }}>Public Key (npub)</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <code style={{ fontSize: '0.8rem', wordBreak: 'break-all', userSelect: 'all' }}>
                  {nostrUser?.pubkey ? `${nostrUser.pubkey.substring(0, 16)}...${nostrUser.pubkey.substring(nostrUser.pubkey.length - 8)}` : ''}
                </code>
                <button
                  className="btn btn-small"
                  type="button"
                  onClick={() => {
                    if (nostrUser?.pubkey) {
                      navigator.clipboard.writeText(nostrUser.pubkey);
                    }
                  }}
                  title="Copy Public Key"
                >
                  <Copy size={14} />
                </button>
              </div>
            </div>
          </div>

          <button
            className="btn btn-delete"
            style={{ width: '100%', padding: '0.75rem', justifyContent: 'center', marginTop: '0.25rem', fontWeight: 700 }}
            onClick={() => {
              logoutNostr();
              onClose();
            }}
          >
            <LogOut size={16} /> Disconnect Account
          </button>
        </div>
      </div>
    </div>
  );
};

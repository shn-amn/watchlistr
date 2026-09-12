import React from 'react';
import { UserX, X } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  relays: string[];
  relayStatuses: Record<string, boolean>;
  blockedPubkeys: string[];
  profiles: Record<string, { name?: string; picture?: string }>;
  onUnblockUser: (pubkey: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  relays,
  relayStatuses,
  blockedPubkeys,
  profiles,
  onUnblockUser
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h3 className="modal-title" style={{ margin: 0, fontSize: '1.25rem' }}>App Settings</h3>
          <button className="btn btn-action-icon" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Relays Section */}
          <div>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 700 }}>Connected Relays</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {relays.map(relay => {
                const status = relayStatuses[relay];
                const isConnected = status === true;
                const statusText = status === true ? 'connected' : status === false ? 'disconnected' : 'connecting';
                return (
                  <div key={relay} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                    <span style={{ fontFamily: 'monospace' }}>{relay}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: isConnected ? '#22c55e' : '#eab308' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: isConnected ? '#22c55e' : '#eab308' }}></span>
                      {statusText}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Blocked Users Section */}
          <div>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 700 }}>
              Blocked Users ({blockedPubkeys.length})
            </h4>
            {blockedPubkeys.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                No blocked users.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                {blockedPubkeys.map(pk => {
                  const profile = profiles[pk];
                  const displayName = profile?.name || `${pk.substring(0, 8)}...${pk.substring(pk.length - 4)}`;
                  return (
                    <div key={pk} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.75rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {profile?.picture ? (
                          <img src={profile.picture} alt={displayName} style={{ width: '20px', height: '20px', borderRadius: '50%' }} />
                        ) : (
                          <div className="profile-avatar-fallback" style={{ width: '20px', height: '20px', fontSize: '0.7rem' }}>
                            {displayName.substring(0, 1).toUpperCase()}
                          </div>
                        )}
                        <span style={{ fontWeight: 600 }}>{displayName}</span>
                      </div>
                      <button
                        className="btn btn-small"
                        onClick={() => onUnblockUser(pk)}
                        title="Unblock user"
                      >
                        <UserX size={14} /> Unblock
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

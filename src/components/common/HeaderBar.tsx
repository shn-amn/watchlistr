import React from 'react';
import { LogIn, Settings } from 'lucide-react';
import type { NostrUser, ConnectionStatus } from '../../types';

interface HeaderBarProps {
  nostrUser: NostrUser | null;
  isSyncing: boolean;
  onOpenSettings: () => void;
  onOpenConnection: () => void;
  onOpenLogin: () => void;
  connectionStatus?: ConnectionStatus;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  nostrUser,
  isSyncing,
  onOpenSettings,
  onOpenConnection,
  onOpenLogin,
  connectionStatus
}) => {
  const isBroken = connectionStatus === 'broken';

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
      <button
        className="btn btn-responsive"
        onClick={onOpenSettings}
        title="App Settings"
      >
        <Settings size={18} /> <span className="btn-label">Settings</span>
      </button>

      {nostrUser ? (
        <div
          className="nostr-user-info clickable"
          onClick={onOpenConnection}
          style={{ margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          title={isBroken ? "Connection broken — click to reconnect" : "Click to view connection info or disconnect"}
        >
          {isSyncing && <div className="spinner" style={{ width: '14px', height: '14px', border: '2px solid var(--bg-tertiary)', borderTop: '2px solid var(--accent-color)', marginRight: '6px' }}></div>}
          {nostrUser.picture && (
            <img
              src={nostrUser.picture}
              alt="Avatar"
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: isBroken ? '1px solid #ef4444' : '1px solid var(--border-color)',
                marginRight: '6px',
                filter: isBroken ? 'grayscale(100%)' : 'none',
                opacity: isBroken ? 0.6 : 1,
                transition: 'all var(--transition-fast)'
              }}
            />
          )}
          <span
            className="nostr-pubkey"
            style={{
              fontWeight: 700,
              fontSize: '1.05rem',
              color: isBroken ? 'var(--text-tertiary)' : undefined,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title={nostrUser.pubkey}
          >
            {nostrUser.name || `${nostrUser.pubkey.substring(0, 8)}...${nostrUser.pubkey.substring(nostrUser.pubkey.length - 4)}`}
            {isBroken && (
              <span
                style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444'
                }}
                title="Disconnected"
              />
            )}
          </span>
        </div>
      ) : (
        <button
          className="btn btn-primary"
          onClick={onOpenLogin}
          style={{ fontWeight: 700, padding: '0.45rem 1.1rem', fontSize: '0.95rem' }}
        >
          <LogIn size={16} /> Log in
        </button>
      )}
    </div>
  );
};


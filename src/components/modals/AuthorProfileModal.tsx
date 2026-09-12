import React from 'react';
import { UserMinus, UserPlus, UserX, X } from 'lucide-react';
import type { MediaList, NostrUser } from '../../types';
import { renderListTitle } from '../../utils';

interface AuthorProfileModalProps {
  isOpen: boolean;
  pubkey: string | null;
  onClose: () => void;
  followedProfiles: Record<string, { name?: string; picture?: string }>;
  exploreProfiles: Record<string, { name?: string; picture?: string }>;
  followedPubkeys: string[];
  nostrUser: NostrUser | null;
  followedListsMap: Record<string, MediaList[]>;
  exploreLists: MediaList[];
  blockedPubkeys: string[];
  onFollowUser: (pk: string) => void;
  onUnfollowUser: (pk: string) => void;
  onBlockUser: (pk: string) => void;
  onUnblockUser: (pk: string) => void;
  onOpenWatchlist: (listId: string) => void;
}

export const AuthorProfileModal: React.FC<AuthorProfileModalProps> = ({
  isOpen,
  pubkey,
  onClose,
  followedProfiles,
  exploreProfiles,
  followedPubkeys,
  nostrUser,
  followedListsMap,
  exploreLists,
  blockedPubkeys,
  onFollowUser,
  onUnfollowUser,
  onBlockUser,
  onUnblockUser,
  onOpenWatchlist
}) => {
  if (!isOpen || !pubkey) return null;

  const pk = pubkey;
  const profile = followedProfiles[pk] || exploreProfiles[pk];
  const displayName = profile?.name || `${pk.substring(0, 8)}...${pk.substring(pk.length - 4)}`;
  const isFollowing = followedPubkeys.includes(pk);
  const isSelf = nostrUser?.pubkey === pk;
  const userLists = followedListsMap[pk] || exploreLists.filter(l => l.id.startsWith(`social:${pk}:`));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '480px', width: '90%' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h3 className="modal-title" style={{ margin: 0 }}>Author Profile</h3>
          <button className="btn btn-action-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '1.25rem 0 0.5rem 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '1.25rem' }}>
            {profile?.picture ? (
              <img
                src={profile.picture}
                alt={displayName}
                style={{ width: '52px', height: '52px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-color)' }}
              />
            ) : (
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-color)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem',
                  fontWeight: 700
                }}
              >
                {displayName.substring(0, 1).toUpperCase()}
              </div>
            )}

            <div style={{ flex: 1, minWidth: 0 }}>
              <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, wordBreak: 'break-word' }}>{displayName}</h4>
              <div
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-tertiary)',
                  marginTop: '0.2rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span style={{ fontFamily: 'monospace' }}>npub: {pk.substring(0, 10)}...{pk.substring(pk.length - 6)}</span>
              </div>
            </div>
          </div>

          {!isSelf && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '1.25rem' }}>
              {isFollowing ? (
                <button
                  className="btn btn-action-icon btn-delete"
                  style={{ flex: 1, justifyContent: 'center', padding: '0.6rem 1rem' }}
                  onClick={() => onUnfollowUser(pk)}
                >
                  <UserMinus size={16} /> Unfollow
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: 'center', padding: '0.6rem 1rem' }}
                  onClick={() => onFollowUser(pk)}
                >
                  <UserPlus size={16} /> Follow
                </button>
              )}

              {blockedPubkeys.includes(pk) ? (
                <button
                  className="btn"
                  style={{ flex: 1, justifyContent: 'center', padding: '0.6rem 1rem' }}
                  onClick={() => onUnblockUser(pk)}
                  title="Unblock profile"
                >
                  <UserX size={16} /> Unblock
                </button>
              ) : (
                <button
                  className="btn btn-action-icon btn-delete"
                  style={{ flex: 1, justifyContent: 'center', padding: '0.6rem 1rem' }}
                  onClick={() => {
                    onBlockUser(pk);
                    onClose();
                  }}
                  title="Block profile"
                >
                  <UserX size={16} /> Block
                </button>
              )}
            </div>
          )}

          <div>
            <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
              Public Watchlists ({userLists.length})
            </h5>

            {userLists.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                No public watchlists loaded for this profile yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {userLists.map(list => (
                  <div
                    key={list.id}
                    style={{
                      padding: '0.6rem 0.8rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      onClose();
                      onOpenWatchlist(list.id);
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{renderListTitle(list)}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        {list.items.length} item{list.items.length === 1 ? '' : 's'}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-color)' }}>Open →</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

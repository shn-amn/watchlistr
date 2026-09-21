import React, { useMemo } from 'react';
import { User, Globe, Users, RefreshCw, Plus, UserPlus, UserMinus, CloudOff } from 'lucide-react';
import type { MediaList, NostrUser, ConnectionStatus } from '../types';
import { renderListTitle } from '../utils';
import { HeaderBar, ListCardPosterStrip } from '../components/common';

export interface HubViewProps {
  nostrUser: NostrUser | null;
  isSyncing: boolean;
  onOpenSettings: () => void;
  onOpenConnection: () => void;
  onOpenLogin: () => void;
  connectionStatus?: ConnectionStatus;
  isEntityPending?: (entityId: string) => boolean;

  activeHubTab: 'my-lists' | 'explore' | 'following';
  setActiveHubTab: (tab: 'my-lists' | 'explore' | 'following') => void;

  lists: MediaList[];
  onOpenNewListModal: () => void;
  onSyncFromNostr: (pubkey: string) => void;

  exploreLists: MediaList[];
  exploreProfiles: Record<string, any>;
  isExploreLoading: boolean;
  isExploreLoadingMore: boolean;
  hasMoreExplore: boolean;
  exploreObserverRef: React.RefObject<HTMLDivElement | null>;
  onRefreshExplore: (reset?: boolean) => void;
  blockedPubkeys: string[];

  followedPubkeys: string[];
  followedProfiles: Record<string, any>;
  followedListsMap: Record<string, MediaList[]>;
  expandedFollowingUsers: Record<string, boolean>;
  onToggleFollowedUserExpand: (pubkey: string) => void;
  onOpenFollowModal: () => void;
  onUnfollowUser: (pubkey: string) => void;

  onOpenWatchlist: (listId: string) => void;
  onOpenAuthorProfile: (pubkey: string) => void;

  relayStatuses: Record<string, boolean>;
}

export const HubView: React.FC<HubViewProps> = ({
  nostrUser,
  isSyncing,
  onOpenSettings,
  onOpenConnection,
  onOpenLogin,
  connectionStatus,
  isEntityPending,
  activeHubTab,
  setActiveHubTab,
  lists,
  onOpenNewListModal,
  onSyncFromNostr,
  exploreLists,
  exploreProfiles,
  isExploreLoading,
  isExploreLoadingMore,
  hasMoreExplore,
  exploreObserverRef,
  onRefreshExplore,
  blockedPubkeys,
  followedPubkeys,
  followedProfiles,
  followedListsMap,
  expandedFollowingUsers,
  onToggleFollowedUserExpand,
  onOpenFollowModal,
  onUnfollowUser,
  onOpenWatchlist,
  onOpenAuthorProfile,
  relayStatuses
}) => {
  const filteredExploreLists = useMemo(() => {
    const userPk = nostrUser?.pubkey ? nostrUser.pubkey.toLowerCase().trim() : null;
    const blockedSet = new Set(blockedPubkeys.map(pk => pk.toLowerCase().trim()));

    return exploreLists.filter(list => {
      const authorPk = (list.id.split(':')[1] || '').toLowerCase().trim();
      if (userPk && authorPk === userPk) return false;
      if (nostrUser && blockedSet.has(authorPk)) return false;
      return true;
    });
  }, [exploreLists, nostrUser, blockedPubkeys]);

  return (
    <div className="hub-layout">
      {/* Top User Profile / Log In Header */}
      <HeaderBar
        nostrUser={nostrUser}
        isSyncing={isSyncing}
        onOpenSettings={onOpenSettings}
        onOpenConnection={onOpenConnection}
        onOpenLogin={onOpenLogin}
        connectionStatus={connectionStatus}
      />

      {/* Hub Navigation Tabs */}
      <div className="hub-tabs">
        <button
          className={`hub-tab ${activeHubTab === 'my-lists' ? 'active' : ''}`}
          onClick={() => {
            if (!nostrUser) {
              onOpenLogin();
            } else {
              setActiveHubTab('my-lists');
            }
          }}
          title="My Lists"
        >
          <User size={16} /> <span className="tab-label">My Lists {nostrUser ? `(${lists.length})` : ''}</span>
        </button>
        <button
          className={`hub-tab ${activeHubTab === 'explore' ? 'active' : ''}`}
          onClick={() => {
            setActiveHubTab('explore');
            if (filteredExploreLists.length === 0 && !isExploreLoading) {
              onRefreshExplore(true);
            }
          }}
          title="Explore"
        >
          <Globe size={16} /> <span className="tab-label">Explore</span>
        </button>
        <button
          className={`hub-tab ${activeHubTab === 'following' ? 'active' : ''}`}
          onClick={() => {
            if (!nostrUser) {
              onOpenLogin();
            } else {
              setActiveHubTab('following');
            }
          }}
          title="Following"
        >
          <Users size={16} /> <span className="tab-label">Following {nostrUser ? `(${followedPubkeys.length})` : ''}</span>
        </button>
      </div>

      {activeHubTab === 'explore' ? (
        <>
          {/* Explore Feed Section */}
          <div className="hub-title-row">
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Explore Public Watchlists</h2>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Discover recently published media lists (<code>kind:30016</code>) from across the Nostr network in real-time.
              </p>
            </div>
            <button
              className="btn btn-responsive"
              onClick={() => onRefreshExplore(true)}
              disabled={isExploreLoading}
              title="Refresh Explore Feed"
            >
              <RefreshCw size={16} className={isExploreLoading ? 'spin' : ''} /> <span className="btn-label">{isExploreLoading ? 'Refreshing...' : 'Refresh Feed'}</span>
            </button>
          </div>

          {isExploreLoading && filteredExploreLists.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
              <RefreshCw size={28} className="spin" style={{ marginBottom: '0.5rem', color: 'var(--accent-color)' }} />
              <div>Querying relays for public <code>kind:30016</code> watchlists...</div>
            </div>
          ) : filteredExploreLists.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 1.5rem', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
              <Globe size={36} style={{ color: 'var(--accent-color)', marginBottom: '0.75rem' }} />
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>No public lists found</h3>
              <p style={{ margin: '0 0 1.25rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                No recent <code>kind:30016</code> events were returned from connected relays.
              </p>
              <button className="btn btn-primary" onClick={() => onRefreshExplore(true)}>
                <RefreshCw size={16} /> Try Refreshing
              </button>
            </div>
          ) : (
            <div className="following-feed">
              <div className="lists-grid">
                {filteredExploreLists.map(list => {
                  const pubkey = list.id.split(':')[1] || '';
                  const profile = followedProfiles[pubkey] || exploreProfiles[pubkey];
                  const displayName = profile?.name || (pubkey ? `${pubkey.substring(0, 8)}...${pubkey.substring(pubkey.length - 4)}` : 'Anonymous');

                  return (
                    <div key={list.id} className="list-card" onClick={() => onOpenWatchlist(list.id)}>
                      <div className="list-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div
                          className="profile-badge clickable"
                          style={{ fontSize: '0.8rem', cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenAuthorProfile(pubkey);
                          }}
                          title={`View ${displayName}'s profile`}
                        >
                          {profile?.picture ? (
                            <img src={profile.picture} alt={displayName} className="profile-avatar" style={{ width: '22px', height: '22px' }} />
                          ) : (
                            <div className="profile-avatar-fallback" style={{ width: '22px', height: '22px', fontSize: '0.75rem' }}>{displayName.substring(0, 1).toUpperCase()}</div>
                          )}
                          <span className="profile-name" style={{ fontWeight: 600, fontSize: '0.85rem' }}>{displayName}</span>
                        </div>
                      </div>

                      <div className="list-card-footer">
                        <ListCardPosterStrip list={list} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sentinel element for infinite scroll */}
              <div ref={exploreObserverRef} style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '1.5rem' }}>
                {isExploreLoadingMore && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    <RefreshCw size={18} className="spin" style={{ color: 'var(--accent-color)' }} />
                    <span>Loading older watchlists...</span>
                  </div>
                )}
                {!hasMoreExplore && filteredExploreLists.length > 0 && (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                    Reached end of recent public watchlists.
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : activeHubTab === 'my-lists' ? (
        <>
          {/* List Hub Section */}
          <div className="hub-title-row">
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>My Media Lists</h2>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Select a list to view, edit, or add movies & TV shows.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'flex-end', flexShrink: 0 }}>
              {nostrUser && (
                <button
                  className="btn btn-responsive"
                  onClick={() => onSyncFromNostr(nostrUser.pubkey)}
                  disabled={isSyncing}
                  title="Re-sync lists from Nostr relays"
                >
                  <RefreshCw size={16} className={isSyncing ? 'spin' : ''} /> <span className="btn-label">{isSyncing ? 'Syncing...' : 'Sync Relays'}</span>
                </button>
              )}
              <button
                className="btn btn-primary btn-responsive"
                onClick={onOpenNewListModal}
                title="New List"
              >
                <Plus size={16} /> <span className="btn-label">New List</span>
              </button>
            </div>
          </div>

          {/* Grid of List Cards */}
          <div className="lists-grid">
            {lists.map(list => (
              <div
                key={list.id}
                className="list-card"
                onClick={() => onOpenWatchlist(list.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '0.25rem' }}>
                  <h3 className="list-card-title" style={{ margin: 0 }}>{renderListTitle(list)}</h3>
                  {isEntityPending?.(list.id) && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.72rem',
                        color: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '1px 5px',
                        flexShrink: 0
                      }}
                      title="Unsynced changes — will sync when connected"
                    >
                      <CloudOff size={13} />
                      <span>Unsynced</span>
                    </span>
                  )}
                </div>
                <p className="list-card-desc">{list.description || 'No description provided.'}</p>

                <div className="list-card-footer">
                  <ListCardPosterStrip list={list} />
                </div>
              </div>
            ))}

            <div
              className="list-card list-card-create"
              onClick={onOpenNewListModal}
            >
              <Plus size={24} style={{ color: 'var(--accent-color)', marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>Create New List</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
                Publish custom <code>kind:30016</code> logs
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Following Social Feed Tab */}
          <div className="hub-title-row">
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>Following ({followedPubkeys.length})</h2>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Discover media lists (<code>kind:30016</code>) published by your Nostr contacts (<code>kind:10016</code>).
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary btn-responsive"
                onClick={onOpenFollowModal}
                title="Follow Contact"
              >
                <UserPlus size={16} /> <span className="btn-label">Follow Contact</span>
              </button>
            </div>
          </div>

          {followedPubkeys.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem 1.5rem', textAlign: 'center', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
              <Users size={36} style={{ color: 'var(--accent-color)', marginBottom: '0.75rem' }} />
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>You aren't following anyone yet</h3>
              <p style={{ margin: '0 0 1.25rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '460px', marginLeft: 'auto', marginRight: 'auto' }}>
                Follow Nostr profiles by entering their <code>npub</code> key to view their public watchlists and watched review logs.
              </p>
              <button className="btn btn-primary" onClick={onOpenFollowModal}>
                <UserPlus size={16} /> Follow a Nostr Contact
              </button>
            </div>
          ) : (
            <div className="following-feed">
              {followedPubkeys.map(pk => {
                const profile = followedProfiles[pk];
                const userLists = followedListsMap[pk] || [];
                const displayName = profile?.name || `${pk.substring(0, 8)}...${pk.substring(pk.length - 4)}`;
                const isExpanded = Boolean(expandedFollowingUsers[pk]);

                return (
                  <div key={pk} className="following-user-section">
                    <div
                      className={`following-user-header clickable ${isExpanded ? 'expanded' : ''}`}
                      onClick={() => onToggleFollowedUserExpand(pk)}
                      title={isExpanded ? "Click to collapse watchlists" : "Click to expand watchlists"}
                    >
                      <div className="profile-badge">
                        {profile?.picture ? (
                          <img src={profile.picture} alt={displayName} className="profile-avatar" />
                        ) : (
                          <div className="profile-avatar-fallback">{displayName.substring(0, 1).toUpperCase()}</div>
                        )}
                        <div>
                          <div className="profile-name">{displayName}</div>
                          <div className="profile-npub" title={pk}>npub: {pk.substring(0, 10)}...{pk.substring(pk.length - 6)}</div>
                        </div>
                      </div>

                      <button
                        className="btn btn-action-icon btn-delete btn-responsive"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUnfollowUser(pk);
                        }}
                        title="Unfollow user"
                      >
                        <UserMinus size={16} /> <span className="btn-label">Unfollow</span>
                      </button>
                    </div>

                    {isExpanded && (
                      <div style={{ marginTop: '0.75rem' }}>
                        {userLists.length === 0 ? (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', padding: '0.5rem 0' }}>
                            No public <code>kind:30016</code> lists found for this profile on connected relays.
                          </div>
                        ) : (
                          <div className="lists-grid">
                            {userLists.map(list => (
                              <div
                                key={list.id}
                                className="list-card"
                                onClick={() => onOpenWatchlist(list.id)}
                              >
                                <h3 className="list-card-title" style={{ marginTop: '0.25rem' }}>{renderListTitle(list)}</h3>
                                <p className="list-card-desc">{list.description || 'No description provided.'}</p>

                                <div className="list-card-footer">
                                  <ListCardPosterStrip list={list} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Nostr Relay Status Console Footer */}
      {Object.keys(relayStatuses).length > 0 && (
        <footer style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            <span>Relays:</span>
            {Object.entries(relayStatuses).map(([url, connected]) => (
              <span key={url} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: connected ? '#10b981' : '#ef4444' }}></span>
                {url.replace('wss://', '')}
              </span>
            ))}
          </div>
        </footer>
      )}
    </div>
  );
};

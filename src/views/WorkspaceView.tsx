import React, { useState, useEffect, useRef } from 'react';
import {
  Globe,
  Pencil,
  Trash2,
  Plus,
  Film,
  Tv,
  ArrowUpDown,
  ChevronDown,
  Check
} from 'lucide-react';
import type { Media, MediaList, NostrUser, MediaTypeFilter, MediaSortOrder } from '../types';
import {
  renderListTitle,
  renderDirectorCreator,
  getMonthName,
  getRatingEmoji,
  sortWatchedItemsByDefaultScore
} from '../utils';
import { HeaderBar } from '../components/common';

export interface WorkspaceViewProps {
  // Top Header Bar
  nostrUser: NostrUser | null;
  isSyncing: boolean;
  onOpenSettings: () => void;
  onOpenConnection: () => void;
  onOpenLogin: () => void;

  // List Context
  currentList: MediaList | undefined;
  isSocialList: boolean;
  socialProfile?: { pubkey?: string; name?: string; picture?: string } | null;
  onCloseWatchlist: () => void;
  onOpenEditListModal: (list: MediaList) => void;
  onConfirmDeleteList: (list: MediaList) => void;
  onOpenSearchDrawer: () => void;
  onOpenAuthorProfile: (pubkey: string) => void;

  // Media Actions
  onOpenDetailsModal: (item: Media) => void;
  onOpenLogWatchedModal: (item: Media, mode: 'watchlist' | 'edit', listId?: string) => void;
  onRemoveFromWatchlist: (mediaId: string, listId: string) => void;
  onRemoveFromWatched: (mediaId: string, listId: string) => void;
  renderWatchlistRibbon: (item: Media) => React.ReactNode;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  nostrUser,
  isSyncing,
  onOpenSettings,
  onOpenConnection,
  onOpenLogin,
  currentList,
  isSocialList,
  socialProfile,
  onCloseWatchlist,
  onOpenEditListModal,
  onConfirmDeleteList,
  onOpenSearchDrawer,
  onOpenAuthorProfile,
  onOpenDetailsModal,
  onOpenLogWatchedModal,
  onRemoveFromWatchlist,
  onRemoveFromWatched,
  renderWatchlistRibbon
}) => {
  const [mediaTypeFilter, setMediaTypeFilter] = useState<MediaTypeFilter>(null);
  const [mediaSortOrder, setMediaSortOrder] = useState<MediaSortOrder>(null);
  const [isSortModalOpen, setIsSortModalOpen] = useState<boolean>(false);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);

  // Reset filters and sort when switching lists
  useEffect(() => {
    setMediaTypeFilter(null);
    setMediaSortOrder(null);
    setIsSortModalOpen(false);
  }, [currentList?.id]);

  // Click outside to close sort popover menu
  useEffect(() => {
    if (!isSortModalOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setIsSortModalOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSortModalOpen]);

  return (
    <div className="workspace-container">
      {/* Top User Profile / Log In Header */}
      <HeaderBar
        nostrUser={nostrUser}
        isSyncing={isSyncing}
        onOpenSettings={onOpenSettings}
        onOpenConnection={onOpenConnection}
        onOpenLogin={onOpenLogin}
      />

      {/* List Workspace Header */}
      {currentList && (
        <div className="workspace-header-card">
          {isSocialList && socialProfile && (
            <div
              className="social-author-banner clickable"
              onClick={() => socialProfile?.pubkey && onOpenAuthorProfile(socialProfile.pubkey)}
              title={`View ${socialProfile.name}'s profile`}
            >
              <Globe size={16} color="var(--accent-color)" />
              <span>Viewing <strong>{socialProfile.name}</strong>'s public list (Read-Only)</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                <h1 className="workspace-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span
                    className="breadcrumb-author"
                    onClick={onCloseWatchlist}
                    title="Click to go back to Lists"
                  >
                    {isSocialList
                      ? (socialProfile?.name || (currentList.id.split(':')[1] ? `${currentList.id.split(':')[1].substring(0, 8)}...` : 'Guest'))
                      : (nostrUser?.name || (nostrUser?.pubkey ? `${nostrUser.pubkey.substring(0, 8)}...` : 'my'))}
                  </span>
                  <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>/</span>
                  <span>{renderListTitle(currentList)}</span>
                </h1>

                {!isSocialList && (!nostrUser || !nostrUser.readOnly) && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginLeft: '4px' }}>
                    <button
                      className="btn btn-action-icon btn-small"
                      onClick={() => onOpenEditListModal(currentList)}
                      title="Edit list title and description"
                      style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                    >
                      <Pencil size={13} /> <span className="btn-label">Edit</span>
                    </button>
                    <button
                      className="btn btn-action-icon btn-delete btn-small"
                      onClick={() => onConfirmDeleteList(currentList)}
                      title="Delete this list"
                      style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                    >
                      <Trash2 size={13} /> <span className="btn-label">Delete</span>
                    </button>
                  </div>
                )}
              </div>
              <p className="workspace-desc">{currentList.description || 'No description provided.'}</p>
            </div>
            <div className="workspace-stats" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              {!isSocialList && (!nostrUser || !nostrUser.readOnly) && (
                <button className="btn btn-primary btn-responsive" onClick={onOpenSearchDrawer} title="Find & Add">
                  <Plus size={16} /> <span className="btn-label">Find & Add</span>
                </button>
              )}
              <span className="workspace-item-count">{currentList.items.length} Items</span>
            </div>
          </div>
        </div>
      )}

      {/* Media Items List */}
      <div className="workspace-content">
        {!currentList || currentList.items.length === 0 ? (
          <div className="empty-state">
            <Film size={48} className="empty-state-icon" />
            <h3 className="empty-state-title">This list is currently empty</h3>
            {!isSocialList && (!nostrUser || !nostrUser.readOnly) ? (
              <>
                <p className="empty-state-text">
                  Use the <strong>Find & Add</strong> button to find movies or TV shows on TheTVDB and add them to <strong>{currentList ? renderListTitle(currentList) : 'this list'}</strong>.
                </p>
                <button className="btn btn-primary btn-responsive" onClick={onOpenSearchDrawer} title="Find & Add">
                  <Plus size={16} /> <span className="btn-label">Find & Add</span>
                </button>
              </>
            ) : (
              <p className="empty-state-text">
                No items have been added to this list yet.
              </p>
            )}
          </div>
        ) : (
          <div>
            {/* Media Filter & Sort Toolbar */}
            {(() => {
              const movieCount = currentList.items.filter(x => x.type === 'movie').length;
              const tvCount = currentList.items.filter(x => x.type === 'tv').length;

              // 1. Filter by Type
              let processedItems = currentList.items.filter(item => {
                if (mediaTypeFilter === 'movie') return item.type === 'movie';
                if (mediaTypeFilter === 'tv') return item.type === 'tv';
                return true;
              });

              // 2. Sort by selected order
              if (currentList.type === 'watched' && !mediaSortOrder) {
                processedItems = sortWatchedItemsByDefaultScore(processedItems);
              } else if (mediaSortOrder === 'recent') {
                processedItems = [...processedItems].sort((a, b) => {
                  const dateA = a.watchedDate || '';
                  const dateB = b.watchedDate || '';
                  if (dateA && dateB) return dateB.localeCompare(dateA);
                  if (dateA && !dateB) return -1;
                  if (!dateA && dateB) return 1;

                  const yearA = parseInt(a.year, 10) || 0;
                  const yearB = parseInt(b.year, 10) || 0;
                  return yearB - yearA;
                });
              } else if (mediaSortOrder === 'oldest') {
                processedItems = [...processedItems].sort((a, b) => {
                  const dateA = a.watchedDate || '';
                  const dateB = b.watchedDate || '';
                  if (dateA && dateB) return dateA.localeCompare(dateB);
                  if (dateA && !dateB) return -1;
                  if (!dateA && dateB) return 1;

                  const yearA = parseInt(a.year, 10) || 0;
                  const yearB = parseInt(b.year, 10) || 0;
                  return yearA - yearB;
                });
              } else if (mediaSortOrder === 'rating') {
                processedItems = [...processedItems].sort((a, b) => {
                  const ratingA = a.userRating !== undefined ? a.userRating : -1;
                  const ratingB = b.userRating !== undefined ? b.userRating : -1;
                  return ratingB - ratingA;
                });
              } else if (mediaSortOrder === 'lowest') {
                processedItems = [...processedItems].sort((a, b) => {
                  const ratingA = a.userRating !== undefined ? a.userRating : 999;
                  const ratingB = b.userRating !== undefined ? b.userRating : 999;
                  return ratingA - ratingB;
                });
              }

              return (
                <>
                  <div className="media-toolbar-row">
                    {/* Left: Type Filter Chips */}
                    <div className="filter-chips-group">
                      <button
                        type="button"
                        className={`chip-pill ${mediaTypeFilter === 'movie' ? 'active' : ''}`}
                        onClick={() => setMediaTypeFilter(prev => prev === 'movie' ? null : 'movie')}
                        title="Filter by movies"
                      >
                        <Film size={13} />
                        <span>Movies</span>
                        <span className="chip-count">{movieCount}</span>
                      </button>
                      <button
                        type="button"
                        className={`chip-pill ${mediaTypeFilter === 'tv' ? 'active' : ''}`}
                        onClick={() => setMediaTypeFilter(prev => prev === 'tv' ? null : 'tv')}
                        title="Filter by TV shows"
                      >
                        <Tv size={13} />
                        <span className="chip-label-full">TV Shows</span>
                        <span className="chip-label-short">TV</span>
                        <span className="chip-count">{tvCount}</span>
                      </button>
                    </div>

                    {/* Right: Ultra-Compact Dynamic Sort Popover Button (Watched List Only) */}
                    {currentList.type === 'watched' && (
                      <div className="sort-menu-container" ref={sortMenuRef}>
                        <button
                          type="button"
                          className={`sort-dropdown-wrapper ${mediaSortOrder ? 'active' : ''}`}
                          onClick={() => setIsSortModalOpen(prev => !prev)}
                          title="Sort watched list"
                        >
                          {!mediaSortOrder && <ArrowUpDown size={12} className="sort-icon" />}
                          <span className="sort-label">
                            {mediaSortOrder === 'recent'
                              ? 'Newest'
                              : mediaSortOrder === 'oldest'
                                ? 'Oldest'
                                : mediaSortOrder === 'rating'
                                  ? 'Highest'
                                  : mediaSortOrder === 'lowest'
                                    ? 'Lowest'
                                    : 'Default'}
                          </span>
                          <ChevronDown size={11} className="sort-chevron" />
                        </button>

                        {isSortModalOpen && (
                          <div className="sort-popover-backdrop" onClick={() => setIsSortModalOpen(false)}>
                            <div className="sort-popover-menu" onClick={(e) => e.stopPropagation()}>
                              <div className="filter-section">
                                <div className="sort-popover-list">
                                  {[
                                    { value: null, label: 'Default' },
                                    { value: 'recent', label: 'Newest First' },
                                    { value: 'oldest', label: 'Oldest First' },
                                    { value: 'rating', label: 'Highest Rated' },
                                    { value: 'lowest', label: 'Lowest Rated' }
                                  ].map((opt) => {
                                    const isSelected = mediaSortOrder === opt.value;
                                    return (
                                      <button
                                        key={opt.label}
                                        type="button"
                                        className={`sort-option-item ${isSelected ? 'active' : ''}`}
                                        onClick={() => {
                                          setMediaSortOrder(opt.value as any);
                                          setIsSortModalOpen(false);
                                        }}
                                      >
                                        <span>{opt.label}</span>
                                        {isSelected && <Check size={13} className="sort-option-check" />}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {processedItems.length === 0 ? (
                    <div className="empty-state" style={{ padding: '2.5rem 1rem', textAlign: 'center' }}>
                      {mediaTypeFilter === 'movie' ? <Film size={36} style={{ color: 'var(--text-tertiary)', marginBottom: '0.5rem' }} /> : <Tv size={36} style={{ color: 'var(--text-tertiary)', marginBottom: '0.5rem' }} />}
                      <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.05rem', fontWeight: 700 }}>
                        No {mediaTypeFilter === 'movie' ? 'movies' : 'TV shows'} in this list
                      </h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                        This list does not currently have any {mediaTypeFilter === 'movie' ? 'movies' : 'TV shows'}.
                      </p>
                      <button className="btn btn-small" onClick={() => setMediaTypeFilter(null)}>
                        Show All Items ({currentList.items.length})
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {processedItems.map(item => (
                        <div key={item.id} className="media-card" style={{ display: 'flex', alignItems: 'center', padding: '0.85rem 1rem' }}>
                          <div
                            className="poster-container"
                            style={{ cursor: 'pointer' }}
                            onClick={() => onOpenDetailsModal(item)}
                          >
                            {item.poster ? (
                              <img src={item.poster} alt={item.title} className="poster-img" />
                            ) : (
                              <div className="media-placeholder-icon">
                                {item.type === 'movie' ? <Film size={24} /> : <Tv size={24} />}
                              </div>
                            )}
                          </div>

                          <div className="media-info" style={{ flex: 1, minWidth: 0, paddingLeft: '1rem', overflow: 'hidden' }}>
                            <div className="media-header">
                              <span
                                className="media-title clickable"
                                onClick={() => onOpenDetailsModal(item)}
                                title={item.title}
                              >
                                {item.title}
                              </span>
                              <span className={`media-type-badge ${item.type}`}>
                                {item.type === 'movie' ? <Film size={11} /> : <Tv size={11} />}
                                <span>{item.type === 'movie' ? 'Movie' : 'TV'}</span>
                              </span>
                            </div>

                            {renderDirectorCreator(item)}

                            {currentList.type === 'watched' && (item.userRating !== undefined || item.watchedDate) && (
                              <div className="user-log-details" style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {item.userRating !== undefined && (
                                  <div
                                    style={{ fontSize: '1.3rem', lineHeight: '1', cursor: 'default' }}
                                    title={`Rated ${item.userRating}/10`}
                                  >
                                    {getRatingEmoji(item.userRating)}
                                  </div>
                                )}
                                {item.watchedDate && (
                                  <span className="media-year" style={{ fontSize: '0.8rem' }}>
                                    Watched {item.watchedDate.split('-').length === 3
                                      ? `${getMonthName(item.watchedDate.split('-')[1])} ${parseInt(item.watchedDate.split('-')[2], 10)}, ${item.watchedDate.split('-')[0]}`
                                      : item.watchedDate.split('-').length === 2
                                        ? `${getMonthName(item.watchedDate.split('-')[1])} ${item.watchedDate.split('-')[0]}`
                                        : item.watchedDate
                                    }
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="media-actions" style={{ flexShrink: 0, display: 'flex', flexDirection: currentList.type === 'watched' ? 'column' : 'row', alignItems: 'center', gap: '4px' }}>
                            {!isSocialList && currentList.type === 'watchlist' ? (
                              <>
                                <button
                                  className="btn btn-primary btn-responsive"
                                  onClick={() => onOpenLogWatchedModal(item, 'watchlist', currentList.id)}
                                  title="Mark as watched"
                                >
                                  <Check size={14} /> <span className="btn-label">Watched</span>
                                </button>
                                <button
                                  className="btn btn-action-icon btn-delete"
                                  onClick={() => onRemoveFromWatchlist(item.id, currentList.id)}
                                  title="Remove from list"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            ) : !isSocialList && currentList.type === 'watched' ? (
                              <>
                                <button
                                  className="btn btn-action-icon btn-delete"
                                  onClick={() => onRemoveFromWatched(item.id, currentList.id)}
                                  title="Remove from watched log"
                                >
                                  <Trash2 size={14} />
                                </button>
                                <button
                                  className="btn btn-action-icon"
                                  onClick={() => onOpenLogWatchedModal(item, 'edit', currentList.id)}
                                  title="Edit details"
                                >
                                  <Pencil size={14} />
                                </button>
                                {renderWatchlistRibbon(item)}
                              </>
                            ) : (
                              <>
                                {renderWatchlistRibbon(item)}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

import React from 'react';
import { Check, Eye, Film, Plus, Search, Tv, X } from 'lucide-react';
import type { Media, MediaList } from '../../types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  clearSearch: () => void;
  isLoading: boolean;
  error: string | null;
  searchResults: Media[];
  currentList?: MediaList;
  isInDefaultWatched: (id: string) => boolean;
  openDetailsModal: (item: Media) => void;
  renderDirectorCreator: (item: Media) => React.ReactNode;
  renderWatchlistRibbon: (item: Media) => React.ReactNode;
  renderListTitle: (list: MediaList) => React.ReactNode;
  addToWatchlist: (item: Media, listId: string) => void;
  openLogWatchedModal: (item: Media, source: 'search' | 'watchlist' | 'edit', targetListId?: string) => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  searchQuery,
  setSearchQuery,
  clearSearch,
  isLoading,
  error,
  searchResults,
  currentList,
  isInDefaultWatched,
  openDetailsModal,
  renderDirectorCreator,
  renderWatchlistRibbon,
  renderListTitle,
  addToWatchlist,
  openLogWatchedModal
}) => {
  if (!isOpen) return null;

  return (
    <div className="search-drawer-overlay" onClick={onClose}>
      <div className="search-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="search-drawer-header">
          <h3 className="modal-title" style={{ margin: 0 }}>Find & Add Media</h3>
          <button className="btn btn-action-icon" onClick={onClose} title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="search-drawer-body">
          <div className="search-input-box">
            <Search size={15} className="search-input-icon" />
            <input
              type="text"
              className="input-field search-input"
              placeholder="Search movies or TV series on TheTVDB..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button className="btn btn-action-icon search-clear-btn" onClick={clearSearch} title="Clear search">
                <X size={14} />
              </button>
            )}
          </div>

          <div className="search-results-list">
            {isLoading ? (
              <div className="loading-container">
                <div className="spinner"></div>
                <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Searching TheTVDB...</p>
              </div>
            ) : error ? (
              <div className="error-card" style={{ padding: '1rem', fontSize: '0.85rem' }}>{error}</div>
            ) : searchResults.length > 0 ? (
              searchResults.map(item => {
                const alreadyInList = currentList?.items.some(x => x.id === item.id);
                return (
                  <div key={item.id} className="media-card" style={{ display: 'flex', alignItems: 'center', padding: '0.5rem 0.75rem' }}>
                    <div className="poster-container" style={{ width: '48px', height: '68px', cursor: 'pointer' }} onClick={() => openDetailsModal(item)}>
                      {item.poster ? (
                        <img src={item.poster} alt={item.title} className="poster-img" />
                      ) : (
                        <div className="media-placeholder-icon">
                          {item.type === 'movie' ? <Film size={16} /> : <Tv size={16} />}
                        </div>
                      )}
                    </div>

                    <div className="media-info" style={{ flex: 1, minWidth: 0, paddingLeft: '0.75rem', overflow: 'hidden' }}>
                      <div className="media-header">
                        <span className="media-title clickable" onClick={() => openDetailsModal(item)} title={item.title}>
                          {item.title}
                        </span>
                        <span className={`media-type-badge ${item.type}`}>
                          {item.type === 'movie' ? <Film size={11} /> : <Tv size={11} />}
                          <span>{item.type === 'movie' ? 'Movie' : 'TV'}</span>
                        </span>
                      </div>
                      {renderDirectorCreator(item)}
                    </div>

                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {renderWatchlistRibbon(item)}
                      {currentList ? (
                        alreadyInList ? (
                          <button className="btn btn-success" disabled style={{ padding: '4px 8px', fontSize: '0.8rem' }}>
                            <Check size={14} /> Added
                          </button>
                        ) : (
                          <button
                            className="btn btn-primary"
                            onClick={() => {
                              if (currentList.type === 'watchlist') {
                                addToWatchlist(item, currentList.id);
                              } else {
                                openLogWatchedModal(item, 'search', currentList.id);
                              }
                              onClose();
                              clearSearch();
                            }}
                            style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                          >
                            <Plus size={14} /> Add
                          </button>
                        )
                      ) : (
                        isInDefaultWatched(item.id) ? (
                          <button className="btn btn-success" disabled style={{ padding: '4px 8px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Check size={14} /> Logged
                          </button>
                        ) : (
                          <button
                            className="btn btn-primary"
                            onClick={() => {
                              openLogWatchedModal(item, 'search');
                              onClose();
                              clearSearch();
                            }}
                            title="Log as watched"
                            style={{ padding: '4px 8px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Eye size={14} /> Log as watched
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })
            ) : searchQuery.trim() ? (
              <div className="empty-state" style={{ padding: '2rem 0' }}>
                <p className="empty-state-title">No matches found</p>
                <p className="empty-state-text">Try searching for a different title on TheTVDB.</p>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem 1rem', fontSize: '0.9rem' }}>
                Type a title above to search for movies or series to {currentList ? <>add to <strong>{renderListTitle(currentList)}</strong></> : 'bookmark or log as watched'}.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

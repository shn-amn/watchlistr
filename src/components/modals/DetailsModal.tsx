import React from 'react';
import { Check, ExternalLink, Film, Tv, X } from 'lucide-react';
import type { DetailsModalState, Media } from '../../types';

interface DetailsModalProps {
  modal: DetailsModalState;
  watchedList: Media[];
  onClose: () => void;
  onRetry: (item: Media) => void;
  onMarkWatched: (item: Media) => void;
  renderWatchlistRibbon: (item: Media) => React.ReactNode;
}

export const DetailsModal: React.FC<DetailsModalProps> = ({
  modal,
  watchedList,
  onClose,
  onRetry,
  onMarkWatched,
  renderWatchlistRibbon
}) => {
  if (!modal.isOpen || !modal.item) return null;

  const item = modal.item;
  const inWatched = watchedList.some(x => x.id === item.id);
  const hasValidPoster = item.poster && !item.poster.includes('missing/series.jpg') && !item.poster.includes('missing/movie.jpg');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-lg" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h3 className="modal-title" style={{ margin: 0 }}>
            {item.type === 'tv' ? 'TV Show Details' : 'Movie Details'}
          </h3>
          <button
            className="btn btn-action-icon"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {modal.isLoading ? (
          <div className="loading-container" style={{ padding: '3rem 0' }}>
            <div className="spinner"></div>
            <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Fetching detailed information from TheTVDB...
            </p>
          </div>
        ) : modal.error ? (
          <div className="error-card" style={{ margin: '1.5rem 0' }}>
            <p>{modal.error}</p>
            <button className="btn" onClick={() => onRetry(item)}>Retry</button>
          </div>
        ) : modal.extendedInfo ? (
          (() => {
            const info = modal.extendedInfo;
            const overviewText = info.overview || item.overview || 'No description available on TheTVDB.';
            const statusStr = info.status?.name || info.status || 'N/A';
            const firstAiredStr = info.firstAired || info.releaseDate || item.year || 'N/A';
            const runtimeStr = info.averageRuntime ? `${info.averageRuntime} mins` : (info.runtime ? `${info.runtime} mins` : 'N/A');

            let networkStudio = 'N/A';
            if (item.type === 'tv' && info.networks && info.networks.length > 0) {
              networkStudio = info.networks[0].name;
            } else if (item.type === 'movie' && info.studios && info.studios.length > 0) {
              networkStudio = info.studios[0].name;
            } else if (item.creator) {
              networkStudio = item.creator;
            }

            return (
              <div className="details-grid" style={{ padding: '1rem 0' }}>
                <div className="details-poster-col">
                  {hasValidPoster ? (
                    <img src={item.poster} alt={item.title} className="details-poster-img" />
                  ) : (
                    <div className="details-poster-placeholder">
                      {item.type === 'movie' ? <Film size={48} /> : <Tv size={48} />}
                    </div>
                  )}
                </div>

                <div className="details-info-col">
                  <h2 className="details-title">{info.name || item.title}</h2>

                  <div style={{ marginBottom: '0.75rem' }}>
                    {item.genres && item.genres.length > 0 && (
                      <div className="details-genres" style={{ marginBottom: '0.5rem' }}>
                        {item.genres.map((g: any, idx: number) => {
                          const genreStr = typeof g === 'string' ? g : (g?.name || String(g));
                          return <span key={genreStr || idx} className="badge badge-subtle">{genreStr}</span>;
                        })}
                      </div>
                    )}

                    {item.type === 'movie' && item.director && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        Directed by: <strong style={{ color: 'var(--text-primary)' }}>{item.director}</strong>
                      </div>
                    )}
                    {item.type === 'tv' && (info.showrunner || item.creator) && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        Showrunner / Creator: <strong style={{ color: 'var(--text-primary)' }}>{info.showrunner || item.creator}</strong>
                      </div>
                    )}
                  </div>

                  <div className="details-overview">
                    {overviewText}
                  </div>

                  <div className="details-info-table">
                    <span className="details-info-label">Status</span>
                    <span className="details-info-value">{statusStr}</span>

                    <span className="details-info-label">{item.type === 'tv' ? 'First Aired' : 'Released'}</span>
                    <span className="details-info-value">{firstAiredStr}</span>

                    <span className="details-info-label">{item.type === 'tv' ? 'Avg Runtime' : 'Runtime'}</span>
                    <span className="details-info-value">{runtimeStr}</span>

                    <span className="details-info-label">{item.type === 'tv' ? 'Network' : 'Studio'}</span>
                    <span className="details-info-value">{networkStudio}</span>
                  </div>

                  <div style={{ marginTop: 'auto', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {renderWatchlistRibbon(item)}

                      {inWatched ? (
                        <button className="btn btn-success" disabled>
                          <Check size={14} /> Watched
                        </button>
                      ) : (
                        <button
                          className="btn btn-primary"
                          onClick={() => {
                            onClose();
                            onMarkWatched(item);
                          }}
                        >
                          <Check size={14} /> Mark Watched
                        </button>
                      )}
                    </div>

                    {info.slug && (
                      <a
                        href={`https://thetvdb.com/${item.type === 'tv' ? 'series' : 'movies'}/${info.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-subtle"
                        style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                      >
                        View on TVDB <ExternalLink size={12} style={{ marginLeft: '4px' }} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })()
        ) : null}
      </div>
    </div>
  );
};

import { useState, useEffect } from 'react';
import type { Media, DetailsModalState } from '../types';
import { getApiUrl, fetchTVShowrunner } from '../utils';

export function useMediaSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Media[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSearchDrawerOpen, setIsSearchDrawerOpen] = useState(false);

  const [detailsModal, setDetailsModal] = useState<DetailsModalState>({
    isOpen: false,
    item: null,
    isLoading: false,
    error: null,
    extendedInfo: null
  });

  // Debounced search effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const delayDebounce = setTimeout(async () => {
      try {
        const response = await fetch(getApiUrl(`/api/tvdb/search?query=${encodeURIComponent(searchQuery)}`));
        if (!response.ok) {
          throw new Error(`Search request failed with status ${response.status}`);
        }
        const json = await response.json();
        if (json.data) {
          const mapped: Media[] = json.data.flatMap((item: any) => {
            let mediaType: 'movie' | 'tv';
            if (item.type === 'series') {
              mediaType = 'tv';
            } else if (item.type === 'movie') {
              mediaType = 'movie';
            } else {
              return [];
            }

            return [{
              id: `${mediaType}-${item.tvdb_id}`,
              title: item.name,
              year: item.year || 'N/A',
              type: mediaType,
              poster: item.image || item.image_url || item.thumbnail || '',
              genres: Array.isArray(item.genres)
                ? item.genres.map((g: any) => typeof g === 'string' ? g : (g?.name || '')).filter(Boolean)
                : [],
              slug: item.slug || undefined,
              director: item.director || undefined,
              creator: item.network || undefined,
              overview: item.overview || undefined
            }];
          });
          setSearchResults(mapped);
        } else {
          setSearchResults([]);
        }
      } catch (err: any) {
        console.error('Search error:', err);
        setError(err.message || 'An error occurred while communicating with TheTVDB.');
      } finally {
        setIsLoading(false);
      }
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
  };

  const openDetailsModal = async (item: Media) => {
    setDetailsModal({
      isOpen: true,
      item,
      isLoading: true,
      error: null,
      extendedInfo: null
    });

    const numericId = item.id.includes('-') ? item.id.split('-')[1] : item.id;
    const endpoint = item.type === 'tv'
      ? getApiUrl(`/api/tvdb/series/${numericId}/extended`)
      : getApiUrl(`/api/tvdb/movies/${numericId}/extended`);

    try {
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Failed to fetch details: ${response.status}`);
      }
      const json = await response.json();
      let extendedData = json.data || null;

      if (item.type === 'tv' && extendedData) {
        const showrunner = await fetchTVShowrunner(numericId);
        if (showrunner) {
          extendedData = {
            ...extendedData,
            showrunner
          };
        }
      }

      setDetailsModal(prev => ({
        ...prev,
        isLoading: false,
        extendedInfo: extendedData
      }));
    } catch (err: any) {
      console.error('Error fetching extended info:', err);
      setDetailsModal(prev => ({
        ...prev,
        isLoading: false,
        error: 'Could not load details from TheTVDB.'
      }));
    }
  };

  const closeDetailsModal = () => {
    setDetailsModal(prev => ({ ...prev, isOpen: false, item: null, extendedInfo: null }));
  };

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    isLoading,
    error,
    isSearchDrawerOpen,
    setIsSearchDrawerOpen,
    clearSearch,
    detailsModal,
    setDetailsModal,
    openDetailsModal,
    closeDetailsModal
  };
}

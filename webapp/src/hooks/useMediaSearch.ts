import { useState, useEffect } from 'react';
import type { Media, DetailsModalState } from '../types';
import { searchMedia, fetchMediaDetails } from '../utils';

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
        const results = await searchMedia(searchQuery);
        setSearchResults(results);
      } catch (err: any) {
        console.error('Search error:', err);
        setError(err.message || 'An error occurred while communicating with the metadata service.');
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

    try {
      const detail = await fetchMediaDetails(item);
      setDetailsModal(prev => ({
        ...prev,
        isLoading: false,
        extendedInfo: detail
      }));
    } catch (err) {
      console.error('Error fetching extended info:', err);
      setDetailsModal(prev => ({
        ...prev,
        isLoading: false,
        error: 'Could not load details.'
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

import type { Media } from '../types';

/**
 * Prefixes API endpoints with the configured Vite base path (e.g. /watch for nightly).
 */
export const getApiUrl = (endpoint: string): string => {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${cleanEndpoint}`;
};

/**
 * Fetches showrunner / lead writer credits for a TV series from TheTVDB.
 */
export const fetchTVShowrunner = async (seriesId: string): Promise<string | undefined> => {
  try {
    const epRes = await fetch(getApiUrl(`/api/tvdb/series/${seriesId}/episodes/default?page=0`));
    if (epRes.ok) {
      const epJson = await epRes.json();
      const ep1 = epJson.data?.episodes?.find((e: any) => e.seasonNumber === 1 && e.number === 1) || epJson.data?.episodes?.[0];
      if (ep1?.id) {
        const epExtRes = await fetch(getApiUrl(`/api/tvdb/episodes/${ep1.id}/extended`));
        if (epExtRes.ok) {
          const epExtJson = await epExtRes.json();
          const writers = epExtJson.data?.characters
            ?.filter((c: any) => c.peopleType === 'Writer')
            .map((c: any) => c.personName)
            .filter(Boolean);
          if (writers && writers.length > 0) {
            return Array.from(new Set<string>(writers)).join(', ');
          }
        }
      }
    }
  } catch (e) { }
  return undefined;
};

/**
 * Resolves full TVDB metadata (poster, director, creator/showrunner, genres, overview, year)
 * for a list of media items.
 */
export const resolveMediaItems = async (items: Media[]): Promise<Media[]> => {
  return Promise.all(items.map(async (item) => {
    const numericId = item.id.includes('-') ? item.id.split('-')[1] : item.id;
    const endpoint = item.type === 'tv'
      ? getApiUrl(`/api/tvdb/series/${numericId}/extended`)
      : getApiUrl(`/api/tvdb/movies/${numericId}/extended`);

    try {
      let res = await fetch(endpoint);
      if (!res.ok && endpoint.endsWith('/extended')) {
        const stdEndpoint = item.type === 'tv'
          ? getApiUrl(`/api/tvdb/series/${numericId}`)
          : getApiUrl(`/api/tvdb/movies/${numericId}`);
        res = await fetch(stdEndpoint);
      }
      if (!res.ok) throw new Error();
      const json = await res.json();
      const data = json.data;
      if (data) {
        const directorName = item.type === 'movie'
          ? (data.director || data.characters?.find((c: any) => c.peopleType === 'Director')?.personName || undefined)
          : undefined;

        const networkName = item.type === 'tv'
          ? (data.network || data.originalNetwork?.name || (Array.isArray(data.companies?.network) ? data.companies.network[0]?.name : undefined) || undefined)
          : undefined;

        let showrunnerName: string | undefined = undefined;
        if (item.type === 'tv') {
          showrunnerName = await fetchTVShowrunner(numericId);
        }

        const posterUrl = data.image || data.image_url || data.thumbnail || '';

        return {
          ...item,
          title: item.title === 'Loading from the TVDB...' ? (data.name || data.translations?.eng || 'Unknown Title') : item.title,
          year: item.year && item.year !== 'N/A' ? item.year : (data.year || (data.first_air_time ? data.first_air_time.split('-')[0] : (data.firstAired ? data.firstAired.split('-')[0] : 'N/A'))),
          poster: posterUrl || item.poster || '',
          genres: data.genres ? (Array.isArray(data.genres) ? data.genres.map((g: any) => typeof g === 'string' ? g : (g?.name || '')).filter(Boolean) : []) : (item.genres || []),
          slug: data.slug || item.slug || undefined,
          overview: data.overview || item.overview || undefined,
          director: directorName || item.director,
          creator: showrunnerName || networkName || item.creator
        };
      }
    } catch (e) {
      console.error("Error resolving metadata for item", item.id, e);
    }
    return { ...item, title: item.title === 'Loading from the TVDB...' ? 'Unknown Title' : item.title };
  }));
};



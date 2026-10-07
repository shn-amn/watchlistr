import type { Media, MediaDetail } from '../types';

/**
 * Prefixes API endpoints with the configured Vite base path (e.g. /watch for nightly).
 */
export const getApiUrl = (endpoint: string): string => {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${cleanEndpoint}`;
};

const numericId = (media: Media): string =>
  media.id.includes('-') ? media.id.split('-')[1] : media.id;

async function readJSON<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      // Response had no JSON error body; keep the status-based message.
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

/**
 * Searches the media catalog (TVDB-backed) and returns normalized results.
 */
export const searchMedia = async (query: string, limit = 10): Promise<Media[]> => {
  const res = await fetch(getApiUrl(`/api/v1/search?q=${encodeURIComponent(query)}&limit=${limit}`));
  const json = await readJSON<{ results?: Media[] }>(res);
  return json.results ?? [];
};

/**
 * Fetches normalized extended metadata for a single title.
 */
export const fetchMediaDetails = async (media: Media): Promise<MediaDetail> => {
  const res = await fetch(getApiUrl(`/api/v1/media/${media.type}/${numericId(media)}`));
  return readJSON<MediaDetail>(res);
};

/**
 * Resolves metadata for a list of media items in a single backend request.
 * The normalized result is merged into each local item so user-owned fields
 * (watched date, personal rating) are preserved.
 */
export const resolveMediaItems = async (items: Media[]): Promise<Media[]> => {
  if (items.length === 0) return items;

  const fallback = () =>
    items.map((item) => ({
      ...item,
      title: item.title === 'Loading from the TVDB...' ? 'Unknown Title' : item.title,
    }));

  try {
    const res = await fetch(getApiUrl('/api/v1/media/batch'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: items.map((item) => ({ id: item.id, type: item.type })) }),
    });
    const json = await readJSON<{ results?: Media[] }>(res);
    const resolved = new Map((json.results ?? []).map((media) => [media.id, media]));

    return items.map((item) => {
      const meta = resolved.get(item.id);
      if (!meta) {
        return {
          ...item,
          title: item.title === 'Loading from the TVDB...' ? 'Unknown Title' : item.title,
        };
      }
      return {
        ...item,
        ...meta,
        title: item.title === 'Loading from the TVDB...' ? (meta.title || 'Unknown Title') : item.title,
        year: item.year && item.year !== 'N/A' ? item.year : meta.year,
        poster: meta.poster || item.poster,
        genres: meta.genres?.length ? meta.genres : item.genres,
        director: meta.director || item.director,
        creator: meta.creator || item.creator,
        overview: meta.overview || item.overview,
      };
    });
  } catch (err) {
    console.error('Error resolving media metadata', err);
    return fallback();
  }
};

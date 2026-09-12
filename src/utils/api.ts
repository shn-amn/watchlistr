/**
 * Prefixes API endpoints with the configured Vite base path (e.g. /watch for nightly).
 */
export const getApiUrl = (endpoint: string): string => {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${cleanEndpoint}`;
};

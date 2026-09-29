/**
 * API Configuration
 *
 * In development, defaults to '' (same-origin relative proxy via Vite/Express).
 * In production (when React is deployed to Firebase Hosting and Express to Render),
 * VITE_API_BASE_URL specifies the external backend URL (e.g., https://my-sheq-api.onrender.com).
 */

const rawApiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim();

// Strip trailing slash if present
export const API_BASE_URL = rawApiBaseUrl.endsWith('/')
  ? rawApiBaseUrl.slice(0, -1)
  : rawApiBaseUrl;

/**
 * Builds a full API endpoint URL.
 * Example: apiUrl('/api/photos/upload')
 * In dev: '/api/photos/upload'
 * In prod: 'https://my-sheq-api.onrender.com/api/photos/upload'
 */
export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

/** Prefix an application path with Astro's configured deployment base. */
export function withBase(path: `/${string}`): string {
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}${path}`;
}

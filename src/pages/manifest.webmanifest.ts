import { withBase } from '../lib/urls';

export function GET() {
  return new Response(JSON.stringify({
    id: withBase('/'),
    name: 'Diagram Desk',
    short_name: 'Diagram Desk',
    description: 'Visual field notes for building reliable systems.',
    lang: 'en',
    start_url: withBase('/'),
    scope: withBase('/'),
    display: 'standalone',
    background_color: '#f5f1e8',
    theme_color: '#f5f1e8',
    icons: [
      { src: withBase('/icons/icon-192.png'), sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: withBase('/icons/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: withBase('/icons/maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }), { headers: { 'Content-Type': 'application/manifest+json' } });
}

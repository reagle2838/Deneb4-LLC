'use client';

import dynamic from 'next/dynamic';

// Render Keystatic on the client only. Server-rendering the sub-routes
// (e.g. /keystatic/collection/clients) makes Keystatic fetch its own
// /api/keystatic data during SSR, which deadlocks the dev server.
const Keystatic = dynamic(() => import('./keystatic-impl'), { ssr: false });

export default function KeystaticApp() {
  return <Keystatic />;
}

'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** Sends a GA4 page_view on each client-side route change. */
export default function GaPageView({ gaId }: { gaId: string }) {
  const pathname = usePathname();
  useEffect(() => {
    const w = window as unknown as { gtag?: (...args: unknown[]) => void };
    if (typeof w.gtag === 'function') {
      w.gtag('event', 'page_view', { page_path: pathname, send_to: gaId });
    }
  }, [pathname, gaId]);
  return null;
}

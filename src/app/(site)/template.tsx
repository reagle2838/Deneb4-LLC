'use client';

import { usePathname } from 'next/navigation';
import PointerEffects from '@/components/motion/PointerEffects';

/**
 * Remounts on every navigation inside the site group, replaying a short
 * entrance so page changes feel composed. The portal and login are kept
 * still: motion belongs to the marketing site.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const quiet = pathname?.startsWith('/portal') || pathname?.startsWith('/login');

  if (quiet) return <>{children}</>;

  return (
    <div className="page-enter">
      <PointerEffects />
      {children}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import type { WorkImage } from '@/lib/work';

export default function WorkGallery({ images, title }: { images: WorkImage[]; title: string }) {
  const [i, setI] = useState(0);

  const go = (n: number) => setI((prev) => (prev + n + images.length) % images.length);

  useEffect(() => {
    if (images.length < 2) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length]);

  if (images.length === 0) return null;
  const cur = images[i];
  const multiple = images.length > 1;

  const arrowStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '40px',
    height: '40px',
    borderRadius: '9999px',
    background: 'rgba(255,255,255,0.92)',
    border: '1px solid var(--border-accent)',
    color: 'var(--text-heading)',
    fontSize: '22px',
    lineHeight: 1,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  };

  return (
    <div className="mt-12">
      <div className="relative rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-accent)', background: 'var(--bg-alt)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cur.src} alt={cur.caption || title} className="w-full object-contain mx-auto" style={{ maxHeight: '520px' }} />
        {multiple && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous image" style={{ ...arrowStyle, left: '12px' }}>‹</button>
            <button type="button" onClick={() => go(1)} aria-label="Next image" style={{ ...arrowStyle, right: '12px' }}>›</button>
            <div className="absolute bottom-3 right-3 font-spec text-[11px] px-2 py-1 rounded-sm" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
              {i + 1} / {images.length}
            </div>
          </>
        )}
      </div>

      {cur.caption && (
        <p className="text-xs mt-2 text-center" style={{ color: 'var(--text-faint)' }}>{cur.caption}</p>
      )}

      {multiple && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`View image ${idx + 1}`}
              className="flex-shrink-0 rounded-sm overflow-hidden"
              style={{ border: idx === i ? '2px solid var(--accent)' : '1px solid var(--border-accent)', lineHeight: 0 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt="" className="h-16 w-24 object-cover" style={{ opacity: idx === i ? 1 : 0.7 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

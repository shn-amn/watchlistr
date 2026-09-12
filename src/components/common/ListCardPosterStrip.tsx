import React, { useEffect, useRef, useState } from 'react';
import { Film, Tv } from 'lucide-react';
import type { Media, MediaList } from '../../types';
import { sortWatchedItemsByDefaultScore } from '../../utils';

interface ListCardPosterStripProps {
  items?: Media[];
  list?: MediaList;
}

export const ListCardPosterStrip: React.FC<ListCardPosterStripProps> = ({ items: propItems, list }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [maxSlots, setMaxSlots] = useState<number>(5);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSlots = (width: number) => {
      const calculated = Math.max(1, Math.floor((width + 6) / 42));
      setMaxSlots(calculated);
    };

    updateSlots(el.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          updateSlots(entry.contentRect.width);
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rawItems = list ? list.items : (propItems || []);
  const items = list && list.type === 'watched' ? sortWatchedItemsByDefaultScore(rawItems) : rawItems;

  if (!items || items.length === 0) {
    return (
      <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', fontStyle: 'italic', padding: '4px 0' }}>
        Empty list
      </div>
    );
  }

  const showOverflow = items.length > maxSlots;
  const visibleItems = showOverflow ? items.slice(0, maxSlots - 1) : items.slice(0, maxSlots);
  const remainingCount = items.length - visibleItems.length;

  return (
    <div ref={containerRef} style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', width: '100%' }}>
      {visibleItems.map((item, idx) => (
        <div
          key={item.id || `${item.title}-${idx}`}
          style={{
            width: '36px',
            height: '52px',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
            backgroundColor: 'var(--bg-tertiary)',
            flexShrink: 0,
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          title={item.title}
        >
          {item.poster ? (
            <img src={item.poster} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-tertiary)', textAlign: 'center', padding: '2px' }}>
              {item.type === 'tv' ? <Tv size={14} /> : <Film size={14} />}
            </span>
          )}
        </div>
      ))}

      {showOverflow && (
        <div
          style={{
            width: '36px',
            height: '52px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            fontWeight: 750,
            color: 'var(--accent-color)',
            flexShrink: 0
          }}
          title={`${remainingCount} more item${remainingCount === 1 ? '' : 's'}`}
        >
          +{remainingCount}
        </div>
      )}
    </div>
  );
};

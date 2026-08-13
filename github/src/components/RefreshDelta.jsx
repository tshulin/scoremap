// RefreshDelta - the second line inside the "Last updated" pill: how grades
// moved since the previous sync. DeltaValue renders one signed, colored
// percentage; ChangeTicker rotates through multiple changed classes
// vertically, one line at a time.
import React from 'react';

const fmtDelta = (d) => `${d > 0 ? '+' : ''}${d}%`;

export function DeltaValue({ delta }) {
  return (
    <span style={{ fontWeight: 600, color: delta > 0 ? 'var(--color-grade-good)' : 'var(--color-grade-bad)' }}>
      {fmtDelta(delta)}
    </span>
  );
}

const ROW_HEIGHT = 16;
const ROTATE_MS = 2400;
const SLIDE_MS = 300;

export function ChangeTicker({ items }) {
  const [index, setIndex] = React.useState(0);
  const [animate, setAnimate] = React.useState(true);

  React.useEffect(() => {
    setIndex(0);
    if (items.length < 2) return undefined;
    const timer = setInterval(() => setIndex((i) => i + 1), ROTATE_MS);
    return () => clearInterval(timer);
  }, [items]);

  // Seamless wrap: a clone of the first row sits after the last; once the
  // slide onto the clone finishes, snap (unanimated) back to the real first.
  React.useEffect(() => {
    if (index === items.length && items.length > 0) {
      const timer = setTimeout(() => {
        setAnimate(false);
        setIndex(0);
      }, SLIDE_MS + 20);
      return () => clearTimeout(timer);
    }
    if (!animate) {
      const raf = requestAnimationFrame(() => setAnimate(true));
      return () => cancelAnimationFrame(raf);
    }
    return undefined;
  }, [index, animate, items.length]);

  if (items.length === 0) return null;
  const rows = items.length > 1 ? [...items, items[0]] : items;

  return (
    <div style={{ height: ROW_HEIGHT, overflow: 'hidden' }}>
      <div
        style={{
          transform: `translateY(${-index * ROW_HEIGHT}px)`,
          transition: animate ? `transform ${SLIDE_MS}ms ease` : 'none',
        }}
      >
        {rows.map((item, i) => (
          <div
            key={`${item.id}-${i}`}
            style={{
              height: ROW_HEIGHT,
              lineHeight: `${ROW_HEIGHT}px`,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {item.name} <DeltaValue delta={item.delta} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Smooth cursor-follower for chart tooltips, the way layerchart's motion
// springs feel in the original GradeCompass: instead of CSS-transitioning
// left/top (which restarts an 80ms tween on every mousemove and turns shaky
// hand motion into stutter), the box eases toward the cursor every animation
// frame with exponential smoothing (~60ms time constant). Jitter comes out
// low-pass filtered; deliberate movement tracks with a soft, fluid trail.
//
// left/top are written imperatively and deliberately kept OUT of the JSX
// style prop, so React re-renders never snap the box back to a stale spot.
// Which side of the cursor the box sits on (`flip`) stays React state — the
// flip is discrete, has hysteresis, and animates via a CSS transform
// transition on the element.
import React from 'react';

const OFFSET = 14; // gap between cursor and box
const TAU = 60; // smoothing time constant, ms

export function useCursorTooltip() {
  const elRef = React.useRef(null);
  const targetRef = React.useRef({ x: 0, y: 0 });
  const posRef = React.useRef(null); // null → snap to target on attach
  const rafRef = React.useRef(0);
  const lastRef = React.useRef(0);
  const [flip, setFlip] = React.useState({ x: false, y: false });

  const write = () => {
    const el = elRef.current;
    const p = posRef.current;
    if (!el || !p) return;
    el.style.left = `${p.x + OFFSET}px`;
    el.style.top = `${p.y + OFFSET}px`;
  };

  const step = React.useCallback((now) => {
    rafRef.current = 0;
    if (!elRef.current) return;
    const dt = lastRef.current ? Math.min(now - lastRef.current, 100) : 16;
    lastRef.current = now;
    if (!posRef.current) posRef.current = { ...targetRef.current };
    const p = posRef.current;
    const t = targetRef.current;
    const k = 1 - Math.exp(-dt / TAU);
    p.x += (t.x - p.x) * k;
    p.y += (t.y - p.y) * k;
    if (Math.abs(t.x - p.x) < 0.5 && Math.abs(t.y - p.y) < 0.5) {
      p.x = t.x;
      p.y = t.y;
      write();
      lastRef.current = 0;
      return;
    }
    write();
    rafRef.current = requestAnimationFrame(step);
  }, []);

  // Callback ref: on mount, appear at the cursor (no fly-in from a stale
  // corner); on unmount, forget the position so the next hover snaps fresh.
  const tooltipRef = React.useCallback((el) => {
    elRef.current = el;
    if (el) {
      if (!posRef.current) posRef.current = { ...targetRef.current };
      write();
    } else {
      posRef.current = null;
    }
  }, []);

  // Feed the latest cursor position (container-relative) from mousemove.
  const onMove = React.useCallback(
    (evt, rect) => {
      const x = evt.clientX - rect.left;
      const y = evt.clientY - rect.top;
      targetRef.current = { x, y };
      setFlip((prev) => {
        const fx = prev.x ? x > rect.width * 0.45 : x > rect.width * 0.65;
        const fy = prev.y ? y > rect.height * 0.4 : y > rect.height * 0.7;
        return fx === prev.x && fy === prev.y ? prev : { x: fx, y: fy };
      });
      if (!rafRef.current) {
        lastRef.current = 0;
        rafRef.current = requestAnimationFrame(step);
      }
    },
    [step],
  );

  React.useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Style for the tooltip element: the animated side-flip only — position is
  // driven imperatively above.
  const flipStyle = {
    transform: `translateX(${flip.x ? 'calc(-100% - 28px)' : '0px'}) translateY(${flip.y ? 'calc(-100% - 28px)' : '0px'})`,
    transition: 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1)',
  };

  return { tooltipRef, onMove, flipStyle };
}

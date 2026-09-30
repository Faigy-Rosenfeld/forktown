import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  drawBreakAd,
  drawBreakCard,
  loadReel,
  REEL_RETRY_MS,
  reelMissing,
  reelReady,
} from '../city/cinema-films';
import { breakOpacity, type ActiveBreak } from '../lib/live-breaks';
import type { FilmsState } from '../lib/live-harness';

const W = 320,
  H = 180;
/**
 * Every face the ads and cards write in. Canvas text never waits for a font: it paints in a
 * fallback until the face arrives, so the break asks for all of them before its first frame.
 */
export const BREAK_FONTS = [
  '500 20px Fraunces',
  'italic 500 9px Fraunces',
  'bold 10px "Space Mono"',
  '500 12px "DM Sans"',
];

const filmsNow = (): FilmsState => (reelReady() ? 'ready' : reelMissing() ? 'missing' : 'loading');

/**
 * Whether the break pictures (the films chunk and the fonts) can draw. Asked for on mount when
 * the page has any break, welcome or forced item on; otherwise this only reports what the
 * cinema happened to load. `settledAt` is when loading first finished, either way, and
 * `readyAt` when the pictures could first draw (both Date.now() ms).
 */
export function useBreakFilms(wanted: boolean) {
  const [films, setFilms] = useState<{
    state: FilmsState;
    settledAt: number | null;
    readyAt: number | null;
  }>(() => ({ state: 'loading', settledAt: null, readyAt: null }));
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const settle = () => {
      if (!live) return;
      const state = filmsNow();
      const now = Date.now();
      setFilms((old) => ({
        state,
        settledAt: old.settledAt ?? now,
        readyAt: old.readyAt ?? (state === 'ready' ? now : null),
      }));
      // A missing reel asks again on the cinema's own schedule, and the breaks come back with it.
      if (state !== 'ready') retry = setTimeout(attempt, REEL_RETRY_MS);
    };
    const fonts = typeof document !== 'undefined' && document.fonts;
    const faces = fonts ? BREAK_FONTS.map((face) => fonts.load(face)) : [];
    const attempt = () => void Promise.allSettled([loadReel(), ...faces]).then(settle);
    attempt();
    return () => {
      live = false;
      clearTimeout(retry);
    };
  }, [wanted]);
  return wanted ? films : { state: filmsNow(), settledAt: null, readyAt: null };
}

/**
 * A break on the live stream: the 320×180 ad or card, scaled whole over the town with dusk
 * around it, fading in and out over its first and last 400 ms. Hidden from assistive tech:
 * the town canvas's own label names what is on air.
 */
export default function BreakOverlay({ active, ms }: { active: ActiveBreak | null; ms: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const shown = active && reelReady() ? active : null;
  const opacity = shown ? breakOpacity(shown, ms) : 0;
  useLayoutEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!shown || !ctx) return;
    const elapsed = Math.max(0, (ms - shown.start) / 1000);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, W, H);
    if (shown.item.kind === 'ad') drawBreakAd(ctx, shown.item.ad, elapsed);
    else drawBreakCard(ctx, shown.item.card, elapsed, shown.data);
  }, [shown, ms]);
  if (!shown) return null;
  return (
    <div className="live-break" aria-hidden="true" style={{ opacity }}>
      <canvas ref={canvas} width={W} height={H} />
    </div>
  );
}

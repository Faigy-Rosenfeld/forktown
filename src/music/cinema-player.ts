import type { Playable } from '../lib/break-cards';
import { renderCinemaTrack } from './synth';

export type CinemaPlayback = {
  film: Playable;
  elapsed: number;
  key: string;
  gain: number;
  pan: number;
};

/** Shares the town's AudioContext and master volume. All start offsets follow the screen. */
export class CinemaPlayer {
  private gain: GainNode;
  private pan: StereoPannerNode;
  private cache = new Map<string, Promise<AudioBuffer>>();
  private latest?: CinemaPlayback & { sampledAt: number };
  private current?: {
    source: AudioBufferSourceNode;
    envelope: GainNode;
    key: string;
    offset: number;
  };
  private pending?: string;
  private failedKey?: string;
  private disposed = false;
  private sources = new Map<AudioBufferSourceNode, GainNode>();
  constructor(
    private context: AudioContext,
    output: AudioNode,
    private duck: (gain: number) => void,
  ) {
    this.gain = context.createGain();
    this.pan = context.createStereoPanner();
    this.gain.gain.value = 0;
    this.gain.connect(this.pan).connect(output);
  }
  sync(state?: CinemaPlayback) {
    if (this.disposed) return;
    if (
      !state ||
      state.gain < 0.005 ||
      state.elapsed < 0 ||
      state.elapsed >= state.film.duration ||
      this.context.state !== 'running'
    ) {
      this.stop(this.context.state !== 'running');
      return;
    }
    const time = this.context.currentTime;
    if (this.failedKey === state.key) return;
    this.latest = { ...state, sampledAt: time };
    this.gain.gain.setTargetAtTime(Math.min(1, state.gain), time, 0.08);
    this.pan.pan.setTargetAtTime(Math.max(-1, Math.min(1, state.pan)), time, 0.08);
    if (
      this.current?.key === state.key &&
      Math.abs(time - this.current.offset - state.elapsed) < 0.18
    ) {
      this.duck(state.gain);
      return;
    }
    this.release();
    this.duck(0);
    if (this.pending === state.key) return;
    this.pending = state.key;
    const rendered = this.render(state.film);
    const key = state.key;
    void rendered
      .then((buffer) => {
        if (this.pending !== key) return;
        this.pending = undefined;
        const latest = this.latest;
        if (this.disposed || !latest || latest.key !== key || this.context.state !== 'running')
          return;
        const now = this.context.currentTime;
        const elapsed = latest.elapsed + now - latest.sampledAt;
        if (elapsed >= latest.film.duration) return;
        const source = this.context.createBufferSource(),
          envelope = this.context.createGain();
        source.buffer = buffer;
        source.loop = false;
        envelope.gain.setValueAtTime(0, now);
        envelope.gain.linearRampToValueAtTime(1, now + 0.035);
        source.connect(envelope).connect(this.gain);
        this.sources.set(source, envelope);
        source.onended = () => {
          source.disconnect();
          envelope.disconnect();
          this.sources.delete(source);
          if (this.current?.source === source) {
            this.current = undefined;
            this.duck(0);
          }
        };
        this.current = { source, envelope, key, offset: now - elapsed };
        source.start(now, elapsed);
        this.duck(latest.gain);
      })
      .catch(() => {
        if (this.pending === key) this.pending = undefined;
        // Leave town music audible and allow an explicit later attempt to retry.
        if (this.cache.get(state.film.id) === rendered) this.cache.delete(state.film.id);
        if (this.latest?.key === key) {
          this.stop();
          this.failedKey = key;
        }
      });
  }
  /** Renders a film, ad or card ahead of time, so its sound is ready the moment it starts. */
  prepare(film: Playable) {
    if (this.disposed || this.cache.has(film.id)) return;
    const rendered = this.render(film);
    // A failed warm-up leaves nothing cached, so playing it later simply tries again.
    void rendered.catch(() => {
      if (this.cache.get(film.id) === rendered) this.cache.delete(film.id);
    });
  }
  /** One render per film id, keeping the last three (the break, the next one, and a spare). */
  private render(film: Playable) {
    let rendered = this.cache.get(film.id);
    if (!rendered) {
      rendered = renderCinemaTrack(film);
      this.cache.set(film.id, rendered);
      if (this.cache.size > 3) this.cache.delete(this.cache.keys().next().value!);
    }
    return rendered;
  }
  private release() {
    if (!this.current) return;
    const now = this.context.currentTime;
    this.current.envelope.gain.cancelAndHoldAtTime(now);
    this.current.envelope.gain.linearRampToValueAtTime(0, now + 0.06);
    this.current.source.stop(now + 0.07);
    this.current = undefined;
  }
  stop(immediate = false) {
    this.latest = undefined;
    this.pending = undefined;
    this.failedKey = undefined;
    if (immediate) {
      for (const [source, gain] of this.sources) {
        source.stop();
        source.disconnect();
        gain.disconnect();
      }
      this.sources.clear();
      this.current = undefined;
    } else this.release();
    this.duck(0);
  }
  get status() {
    return this.failedKey
      ? 'error'
      : this.current
        ? 'playing'
        : this.pending
          ? 'preparing'
          : 'silent';
  }
  dispose() {
    this.disposed = true;
    this.stop(true);
    this.cache.clear();
    this.gain.disconnect();
    this.pan.disconnect();
  }
}

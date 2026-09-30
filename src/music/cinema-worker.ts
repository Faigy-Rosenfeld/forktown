import type { Playable } from '../lib/break-cards';
import { renderCinemaPCM } from './cinema-render';
self.onmessage = (event: MessageEvent<Playable>) => {
  try {
    const mix = renderCinemaPCM(event.data);
    self.postMessage(mix, { transfer: [mix.left.buffer, mix.right.buffer] });
  } catch {
    self.postMessage({ error: 'Could not render the film soundtrack.' });
  }
};

import type { CardArtwork } from '../../lib/break-cards';
import type { CardModule } from '../types';
import { comingUpCard } from './coming-up';
import { neighborsCard } from './neighbors';
import { rightBackCard } from './right-back';
import { welcomeCard } from './welcome';

/** Every break card on the live stream, keyed by artwork. Each card lives in its own module. */
export const CARDS: Record<CardArtwork, CardModule> = {
  'right-back': rightBackCard,
  'coming-up': comingUpCard,
  neighbors: neighborsCard,
  welcome: welcomeCard,
};

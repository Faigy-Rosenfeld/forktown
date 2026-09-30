import type { CardArtwork } from '../../lib/break-cards';
import type { CardModule } from '../types';
import { comingUpScore } from './coming-up-jingle';
import { neighborsScore } from './neighbors-jingle';
import { rightBackScore } from './right-back-jingle';
import { welcomeScore } from './welcome-jingle';

/**
 * The break cards' jingles alone. The audio worker reaches them through ../scores, so they stay
 * draw-free: each jingle file imports only ../score-kit and types, never a card's pictures.
 */
export const CARD_SCORES: Record<CardArtwork, CardModule['score']> = {
  'right-back': rightBackScore,
  'coming-up': comingUpScore,
  neighbors: neighborsScore,
  welcome: welcomeScore,
};

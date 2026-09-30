import type { AdArtwork } from '../../lib/cinema';
import { carryInMoversAd } from './carry-in-movers';
import { duckCrossingAuthorityAd } from './duck-crossing-authority';
import { farmEggsAd } from './farm-eggs';
import { lanternForkElectricAd } from './lantern-fork-electric';
import { discoAd } from './little-stage-disco';
import { matchdayAd } from './matchday';
import { millpondAd } from './millpond';
import { openPlotRealtyAd } from './open-plot-realty';
import { phonesOffAd } from './phones-off';
import { snackBarAd } from './snack-bar';
import { theTreelineAd } from './the-treeline';
import { zooAd } from './willow-grove-zoo';
import type { AdModule } from '../types';

/** Every ad between films, keyed by artwork. Each spot lives in its own module. */
export const ADS: Record<AdArtwork, AdModule> = {
  snacks: snackBarAd,
  phones: phonesOffAd,
  eggs: farmEggsAd,
  matchday: matchdayAd,
  disco: discoAd,
  millpond: millpondAd,
  zoo: zooAd,
  realty: openPlotRealtyAd,
  tube: theTreelineAd,
  ducks: duckCrossingAuthorityAd,
  lanterns: lanternForkElectricAd,
  movers: carryInMoversAd,
};

import type { UI } from '../i18n/ui';
import type { ChartConstellation } from './chart';

/** A constellation's size, energy and progress on one line, as the open questions page writes them. */
export function constellationFacts(c: ChartConstellation, t: UI): string {
  return [
    c.size && t.constellationFact(t.constellationSize, t.constellationSizes[c.size]),
    c.energy && t.constellationFact(t.constellationEnergy, t.constellationEnergies[c.energy]),
    t.constellationSettled(c.settled, c.total),
  ]
    .filter(Boolean)
    .join(' · ');
}

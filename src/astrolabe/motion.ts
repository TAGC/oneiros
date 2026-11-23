/**
 * The night sky's flight between clusterings: the data the build hands the client, and how
 * far along its flight each star is. Pure, so both the build and the client can use it.
 */

/** A star's glyph centre and reach, then its label's anchor and first baseline. */
export type SkySpot = [
  x: number,
  y: number,
  r: number,
  labelX: number,
  labelY: number,
  anchor: 'start' | 'middle' | 'end',
];

export interface SkyMotionData {
  lineHeight: number;
  /** Each star's spot, by number, clustered by area and by constellation. */
  areas: Record<string, SkySpot>;
  constellations: Record<string, SkySpot>;
}

/** How long the whole flight takes, in milliseconds. */
export const FLIGHT_MS = 1200;
/** The share of the flight over which the stars set off, one after another. */
export const STAGGER = 0.3;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** How far along its own flight star `n` is, from 0 to 1, at time `t` of the whole flight. */
export function flight(t: number, n: number): number {
  const lag = (((n * 37) % 11) / 10) * STAGGER;
  const own = (t - lag) / (1 - STAGGER);
  return ease(Math.min(1, Math.max(0, own)));
}

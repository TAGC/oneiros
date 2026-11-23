/**
 * The Dial: what it shows for the state (its panel, and the time and energy filter on its
 * marks), and starting at its middle on a narrow screen. A star link in a panel leads to the
 * night sky by the state (`state.ts`).
 */
import { fitsFilter, setUpPanel } from './client-common';
import type { Store } from './state-client';

export function setUpBrass(root: HTMLElement, store: Store): void {
  const dial = root.querySelector<SVGSVGElement>('.al-brass');
  const view = root.querySelector<HTMLElement>('.al-view-brass');
  if (!dial || !view) return;

  /* On a narrow screen the dial is wider than the frame: start at its middle. */
  const centre = () => {
    view.scrollLeft = (view.scrollWidth - view.clientWidth) / 2;
    view.scrollTop = (view.scrollHeight - view.clientHeight) / 2;
  };
  store.subscribe(({ state, prev }) => {
    if (state.view === 'brass' && prev.view !== 'brass') requestAnimationFrame(centre);
  });

  /* The panel. */
  const markOf = (n: number) => root.querySelector<SVGAElement>(`.al-cmark[data-c="${n}"]`);
  setUpPanel(root, store, 'constellation', {
    prefix: 'constellation-panel-',
    mark: '.al-cmark',
    marksOf: (n) => [markOf(n)].filter((m) => m !== null),
    maps: [dial],
    returnFocus: markOf,
  });

  /* The time and energy filter. */
  store.subscribe(({ state, prev }) => {
    if (state.filter === prev.filter) return;
    for (const mark of root.querySelectorAll('.al-cmark')) {
      mark.classList.toggle('al-unfit', !fitsFilter(mark, state.filter));
    }
  });
}

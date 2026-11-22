/**
 * The constellations view's interaction, beside `client.ts`: the constellation panel, the
 * time and energy filter on the dial, and star links that lead to the night sky. It works
 * through the page itself (the view buttons, the filter's pressed buttons), so it needs
 * nothing from `client.ts` but the order of loading.
 */
import { fitsFilter, readFilter, readSetting, setUpPanel } from './client-common';

const brassRoot = document.querySelector<HTMLElement>('.astrolabe');
if (brassRoot?.querySelector('.al-brass')) setUpBrass(brassRoot);

function setUpBrass(root: HTMLElement): void {
  const dial = root.querySelector<SVGSVGElement>('.al-brass')!;
  const view = root.querySelector<HTMLElement>('.al-view-brass')!;
  const showView = (name: string) =>
    root.querySelector<HTMLButtonElement>(`.al-views button[data-view="${name}"]`)?.click();

  /* On a narrow screen the dial is wider than the frame: start at its middle. */
  const centre = () => {
    view.scrollLeft = (view.scrollWidth - view.clientWidth) / 2;
    view.scrollTop = (view.scrollHeight - view.clientHeight) / 2;
  };
  root.querySelector('.al-views')?.addEventListener('click', () => {
    if (root.dataset.view === 'brass') requestAnimationFrame(centre);
  });

  /* The panel. */
  const markOf = (n: number) => root.querySelector<SVGAElement>(`.al-cmark[data-c="${n}"]`);
  const constellation = setUpPanel(root, {
    prefix: 'constellation-panel-',
    mark: '.al-cmark',
    marksOf: (n) => [markOf(n)].filter((m) => m !== null),
    maps: [dial],
    returnFocus: markOf,
  });

  // A star link leaves the dial for the night sky, where `client.ts` opens the star.
  root.addEventListener(
    'click',
    (e) => {
      if (!(e.target as Element).closest('a[href^="#star-"]')) return;
      if (constellation.current() !== undefined) constellation.close();
      if (root.dataset.view === 'brass') showView('sky');
    },
    true,
  );

  /* The time and energy filter, as in `client.ts`. */
  const applyFilter = () => {
    const chosen = readFilter(root);
    for (const mark of root.querySelectorAll('.al-cmark')) {
      mark.classList.toggle('al-unfit', !fitsFilter(mark, chosen));
    }
  };
  root.querySelector('.al-cfilter')?.addEventListener('click', applyFilter);

  /* Open the view (`#constellations`) or the constellation a link points to, or the view
     last used. */
  const fromHash = /^#constellation-panel-(\d+)$/.exec(location.hash);
  const saved = readSetting('astrolabe-view');
  const toView = fromHash || location.hash === '#dial';
  if (toView || (saved === 'brass' && !location.hash.startsWith('#star-'))) showView('brass');
  if (fromHash) constellation.open(Number(fromHash[1]), false);
}

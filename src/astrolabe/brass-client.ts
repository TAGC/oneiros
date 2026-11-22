/**
 * The constellations view's interaction, beside `client.ts`: the constellation panel, the
 * time and energy filter on the dial, and star links that lead to the night sky. It works
 * through the page itself (the view buttons, the filter's pressed buttons), so it needs
 * nothing from `client.ts` but the order of loading.
 */

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
  let open: number | undefined;
  const markOf = (n: number) => root.querySelector<SVGAElement>(`.al-cmark[data-c="${n}"]`);
  const close = () => {
    for (const el of root.querySelectorAll('.al-cpanel.al-open-panel')) {
      el.classList.remove('al-open-panel');
    }
    for (const el of root.querySelectorAll('.al-cmark.al-selected')) {
      el.classList.remove('al-selected');
    }
    dial.classList.remove('al-has-selection');
    open = undefined;
  };
  const show = (n: number, focusPanel = true) => {
    const panel = document.getElementById(`constellation-panel-${n}`);
    if (!panel) return;
    for (const el of root.querySelectorAll('.al-open-panel')) el.classList.remove('al-open-panel');
    close();
    panel.classList.add('al-open-panel');
    panel.scrollTop = 0;
    markOf(n)?.classList.add('al-selected');
    dial.classList.add('al-has-selection');
    open = n;
    history.replaceState(null, '', `#constellation-panel-${n}`);
    if (focusPanel) panel.focus({ preventScroll: true });
  };
  const dismiss = () => {
    const n = open;
    close();
    history.replaceState(null, '', location.pathname + location.search);
    if (n !== undefined) markOf(n)?.focus();
  };

  // A star link leaves the dial for the night sky, where `client.ts` opens the star.
  root.addEventListener(
    'click',
    (e) => {
      if (!(e.target as Element).closest('a[href^="#star-"]')) return;
      if (open !== undefined) close();
      if (root.dataset.view === 'brass') showView('sky');
    },
    true,
  );
  root.addEventListener('click', (e) => {
    const target = e.target as Element;
    if (target.closest('[data-close]')) {
      if (open !== undefined) dismiss();
      return;
    }
    const link = target.closest<Element>('a[href^="#constellation-panel-"]');
    if (!link) return;
    e.preventDefault();
    const n = Number(link.getAttribute('href')!.slice('#constellation-panel-'.length));
    if (n === open && link.classList.contains('al-cmark')) dismiss();
    else show(n);
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open !== undefined) dismiss();
  });

  /* The time and energy filter: a mark fits when its size and energy are at most the ones
     chosen, as in `client.ts`. */
  const SCALES: Record<string, string[]> = {
    size: ['small', 'medium', 'large'],
    energy: ['low', 'medium', 'high'],
  };
  const applyFilter = () => {
    const chosen = [...root.querySelectorAll<HTMLElement>('.al-scale')].map((scale) => ({
      name: scale.dataset.scale!,
      max:
        scale.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.dataset.value ??
        'any',
    }));
    for (const mark of root.querySelectorAll('.al-cmark')) {
      const fits = chosen.every(({ name, max }) => {
        if (max === 'any') return true;
        const value = mark.getAttribute(`data-${name}`);
        return value !== null && SCALES[name].indexOf(value) <= SCALES[name].indexOf(max);
      });
      mark.classList.toggle('al-unfit', !fits);
    }
  };
  root.querySelector('.al-cfilter')?.addEventListener('click', applyFilter);

  /* Open the view (`#constellations`) or the constellation a link points to, or the view
     last used. */
  const fromHash = /^#constellation-panel-(\d+)$/.exec(location.hash);
  let saved: string | null = null;
  try {
    saved = localStorage.getItem('astrolabe-view');
  } catch {
    /* Storage unavailable: nothing is remembered. */
  }
  const toView = fromHash || location.hash === '#constellations';
  if (toView || (saved === 'brass' && !location.hash.startsWith('#star-'))) showView('brass');
  if (fromHash) show(Number(fromHash[1]), false);
}

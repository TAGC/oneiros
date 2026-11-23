/**
 * The night sky and the tiers: what they show for the state (the view, the clustering, the
 * time and energy filter), the star panel, highlighting a star's threads, and pan and zoom on
 * the night sky. The map itself is static SVG from the build; the state is `state-client.ts`.
 */
import { fitsFilter, setUpPanel } from './client-common';
import type { SkyMotionData } from './motion';
import { skyMotion } from './sky-motion';
import type { Store } from './state-client';
import { boxTransform, type Fit, panBox, toSky, type ViewBox, zoomBox } from './viewbox';

export function setUpSky(root: HTMLElement, store: Store): void {
  const zoom = root.querySelector<HTMLElement>('.al-zoom')!;
  zoom.hidden = false;
  const maps = [...root.querySelectorAll<SVGSVGElement>('.al-sky, .al-tiers')];
  const sky = root.querySelector<SVGSVGElement>('.al-sky')!;
  /** The sky and its decoration layer, which pan and zoom together. */
  const layers = [...root.querySelectorAll<SVGSVGElement>('.al-sky-back, .al-sky')];
  const skyView = root.querySelector<HTMLElement>('.al-view-sky')!;
  const tiersView = root.querySelector<HTMLElement>('.al-view-tiers')!;

  /* On a narrow screen, open the tiers at the frontier rather than at settled ground. */
  store.subscribe(({ state, prev }) => {
    if (state.view !== 'tiers' || prev.view === 'tiers') return;
    const shown = root.querySelector<SVGElement>(`.al-tiers[data-by="${state.clustering}"]`);
    const frontierX = Number(shown?.dataset.frontierX);
    if (tiersView.scrollLeft === 0 && tiersView.clientWidth < 700) {
      tiersView.scrollLeft = frontierX - 8;
    }
  });

  /* Clustering by area or by constellation: the sky's stars fly between the two. */
  const motionData = root.querySelector('.al-sky-motion')?.textContent;
  if (motionData) {
    const motion = skyMotion(sky, JSON.parse(motionData) as SkyMotionData);
    store.subscribe(({ state, prev, action }) => {
      if (state.clustering === prev.clustering) return;
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
      motion.show(state.clustering, !!action && !still && state.view === 'sky');
    });
  }

  /* The time and energy filter: constellations that do not fit dim, and their stars. */
  const fitText = root.querySelector<HTMLElement>('.al-cfilter .al-fit');
  const fitTexts = JSON.parse(fitText?.dataset.texts ?? '[]') as string[];
  store.subscribe(({ state, prev }) => {
    if (state.filter === prev.filter) return;
    const fits = (el: Element) => fitsFilter(el, state.filter);
    const unfit = new Set<string>();
    let fitting = 0;
    for (const group of root.querySelectorAll('.al-cgroup:not(.al-cfinished)')) {
      const ok = fits(group);
      group.classList.toggle('al-unfit', !ok);
      if (ok) fitting++;
      else unfit.add(group.getAttribute('data-c')!);
    }
    for (const card of root.querySelectorAll('.al-card')) {
      card.classList.toggle('al-unfit', !fits(card));
    }
    for (const star of root.querySelectorAll('.al-star[data-c]')) {
      star.classList.toggle('al-unfit', unfit.has(star.getAttribute('data-c')!));
    }
    if (fitText) fitText.textContent = fitTexts[fitting];
  });

  /* Selection and the panel. A drag on the sky is not a click on a star. */
  let dragged = false;
  let returnFocus: Element | null = null;
  const starsOf = (n: number) => root.querySelectorAll(`.al-star[data-n="${n}"]`);
  const threadsOf = (n: number) =>
    root.querySelectorAll(`.al-thread[data-from="${n}"], .al-thread[data-to="${n}"]`);
  const highlight = (n: number | undefined, cls: string) => {
    for (const el of root.querySelectorAll(`.${cls}`)) el.classList.remove(cls);
    if (n === undefined) return;
    for (const t of threadsOf(n)) t.classList.add(cls);
  };
  setUpPanel(root, store, 'star', {
    prefix: 'star-',
    mark: '.al-star',
    marksOf: starsOf,
    maps,
    returnFocus: () => returnFocus,
    onLink: (link) => {
      if (dragged) return false;
      if (link.classList.contains('al-star')) returnFocus = link;
      return true;
    },
    onOpen: (n) => {
      highlight(n, 'al-lit');
      for (const t of threadsOf(n)) {
        const other = t.getAttribute('data-from') === String(n) ? 'data-to' : 'data-from';
        for (const s of starsOf(Number(t.getAttribute(other)))) s.classList.add('al-near');
      }
      if (store.get().view === 'sky') ensureVisible(n);
    },
    onClose: () => {
      for (const el of root.querySelectorAll('.al-near')) el.classList.remove('al-near');
      highlight(undefined, 'al-lit');
    },
  });

  for (const m of maps) {
    m.addEventListener('pointerover', (e) => {
      const mark = (e.target as Element).closest<Element>('.al-star');
      if (mark && !store.get().panel) {
        highlight(Number(mark.getAttribute('data-n')), 'al-lit');
      }
    });
    m.addEventListener('pointerout', (e) => {
      const mark = (e.target as Element).closest('.al-star');
      if (mark && !store.get().panel) highlight(undefined, 'al-lit');
    });
  }

  /*
   * Pan and zoom on the night sky. Events only update `box`. While the sky moves, the drawn
   * picture is moved by a CSS transform once per frame; redrawing over a thousand SVG
   * elements every frame left the browser showing blank frames. The viewBox catches up
   * (`settle`) when the sky rests, or when the picture drifts so far that it would blur or
   * show its edges. Positions come from `box` rather than the SVG's screen matrix, so no
   * event forces a layout.
   */
  const W = Number(sky.dataset.width);
  const H = Number(sky.dataset.height);
  const home: ViewBox = { x: 0, y: 0, w: W, h: H };
  let box: ViewBox = { ...home };
  /** The box the SVGs are drawn with. */
  let drawn: ViewBox = { ...home };
  let fit: Fit = 'meet';
  let pending = 0;
  let resting: ReturnType<typeof setTimeout> | undefined;
  const settle = () => {
    if (pending) cancelAnimationFrame(pending);
    pending = 0;
    clearTimeout(resting);
    drawn = { ...box };
    for (const layer of layers) {
      layer.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`);
      layer.style.transform = '';
    }
  };
  const write = () => {
    pending = 0;
    const frame = skyView.getBoundingClientRect();
    const { k, tx, ty } = boxTransform(drawn, box, frame, fit);
    const far =
      k > 1.6 || k < 0.75 || Math.abs(tx) > frame.width / 4 || Math.abs(ty) > frame.height / 4;
    if (far) return settle();
    for (const layer of layers) {
      layer.style.transform = `translate(${tx}px, ${ty}px) scale(${k})`;
    }
    clearTimeout(resting);
    resting = setTimeout(settle, 150);
  };
  const apply = () => {
    if (!pending) pending = requestAnimationFrame(write);
  };
  // A tall frame (a phone) fills its height and crops the sides, so the labels stay legible.
  const fill = () => {
    settle();
    const r = skyView.getBoundingClientRect();
    fit = r.height > r.width ? 'slice' : 'meet';
    for (const layer of layers) layer.setAttribute('preserveAspectRatio', `xMidYMid ${fit}`);
  };
  fill();
  new ResizeObserver(fill).observe(skyView);
  // The view's rectangle, not the SVG's: a transform moves the SVG's.
  const zoomAt = (clientX: number, clientY: number, factor: number) => {
    const frame = skyView.getBoundingClientRect();
    box = zoomBox(box, frame, fit, clientX, clientY, factor, W / 10, W * 1.6);
    apply();
  };
  const zoomCentre = (factor: number) => {
    const r = skyView.getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, factor);
  };
  zoom.addEventListener('click', (e) => {
    const button = (e.target as Element).closest<HTMLButtonElement>('button[data-zoom]');
    if (!button) return;
    if (button.dataset.zoom === 'in') zoomCentre(1.4);
    else if (button.dataset.zoom === 'out') zoomCentre(1 / 1.4);
    else {
      box = { ...home };
      apply();
    }
  });
  // The twinkle rests while the sky moves (see .al-dragging and .al-zooming in the CSS).
  let zooming: ReturnType<typeof setTimeout> | undefined;
  skyView.addEventListener(
    'wheel',
    (e) => {
      // A plain wheel scrolls the page; a trackpad pinch arrives with ctrlKey set.
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018)));
      skyView.classList.add('al-zooming');
      clearTimeout(zooming);
      zooming = setTimeout(() => skyView.classList.remove('al-zooming'), 200);
    },
    { passive: false },
  );

  const pointers = new Map<number, { x: number; y: number }>();
  let start: { x: number; y: number } | undefined;
  let pinch: number | undefined;
  skyView.addEventListener('pointerdown', (e) => {
    if ((e.target as Element).closest('.al-zoom')) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    start = { x: e.clientX, y: e.clientY };
    dragged = false;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  });
  skyView.addEventListener('pointermove', (e) => {
    const last = pointers.get(e.pointerId);
    if (!last) return;
    const now = { x: e.clientX, y: e.clientY };
    if (start && Math.hypot(now.x - start.x, now.y - start.y) > 5 && !dragged) {
      dragged = true;
      skyView.setPointerCapture(e.pointerId);
      skyView.classList.add('al-dragging');
    }
    pointers.set(e.pointerId, now);
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d / pinch);
      pinch = d;
      return;
    }
    if (!dragged) return;
    box = panBox(box, skyView.getBoundingClientRect(), fit, now.x - last.x, now.y - last.y);
    apply();
  });
  const end = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = undefined;
    if (!pointers.size) {
      skyView.classList.remove('al-dragging');
      setTimeout(() => (dragged = false), 0);
    }
  };
  skyView.addEventListener('pointerup', end);
  skyView.addEventListener('pointercancel', end);

  /** Pans the sky so a star outside the view (or under the panel) comes into sight. */
  function ensureVisible(n: number) {
    settle();
    const glyph = sky.querySelector<SVGGraphicsElement>(`.al-star[data-n="${n}"] g`);
    if (!glyph) return;
    const r = glyph.getBoundingClientRect();
    const view = skyView.getBoundingClientRect();
    const panel = document.getElementById(`star-${n}`)?.getBoundingClientRect();
    const right = panel && panel.left > view.left + 200 ? panel.left - 20 : view.right - 20;
    const inside =
      r.left > view.left + 20 &&
      r.right < right &&
      r.top > view.top + 20 &&
      r.bottom < view.bottom - 20;
    if (inside) return;
    const target = toSky(box, view, fit, (view.left + right) / 2, (view.top + view.bottom) / 2);
    const at = toSky(box, view, fit, r.left + r.width / 2, r.top + r.height / 2);
    box.x += at.x - target.x;
    box.y += at.y - target.y;
    apply();
  }
}

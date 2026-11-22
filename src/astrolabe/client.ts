/**
 * The Astrolabe's interaction: the view switch, the star panel, highlighting a star's
 * threads, and pan and zoom on the night sky. The map itself is static SVG from the build.
 */

const astrolabe = document.querySelector<HTMLElement>('.astrolabe');
if (astrolabe?.querySelector('.al-frame')) setUp(astrolabe);

function storage(key: string, value?: string): string | null {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    /* Storage unavailable: nothing is remembered. */
  }
  return null;
}

function setUp(root: HTMLElement): void {
  root.classList.add('al-js');
  const views = root.querySelector<HTMLElement>('.al-views')!;
  const zoom = root.querySelector<HTMLElement>('.al-zoom')!;
  views.hidden = false;
  zoom.hidden = false;
  const maps = [...root.querySelectorAll<SVGSVGElement>('.al-sky, .al-tiers')];
  const sky = root.querySelector<SVGSVGElement>('.al-sky')!;
  const skyView = root.querySelector<HTMLElement>('.al-view-sky')!;

  /* Views. */
  const showView = (view: string) => {
    root.dataset.view = view;
    for (const b of views.querySelectorAll('button')) {
      b.setAttribute('aria-pressed', String(b.dataset.view === view));
    }
    storage('astrolabe-view', view);
  };
  const saved = storage('astrolabe-view');
  if (saved === 'tiers') showView('tiers');
  views.addEventListener('click', (e) => {
    const button = (e.target as Element).closest<HTMLButtonElement>('button[data-view]');
    if (button) showView(button.dataset.view!);
  });

  /* Constellations: the switch, and the time and energy filter. */
  const cfilter = root.querySelector<HTMLElement>('.al-cfilter');
  if (cfilter && (Number(cfilter.dataset.total) || root.querySelector('.al-warn'))) {
    cfilter.hidden = false;
    const toggle = cfilter.querySelector<HTMLButtonElement>('.al-ctoggle')!;
    const showConstellations = (on: boolean) => {
      root.dataset.constellations = on ? 'on' : 'off';
      toggle.setAttribute('aria-pressed', String(on));
      storage('astrolabe-constellations', on ? 'on' : 'off');
    };
    const remembered = storage('astrolabe-constellations');
    showConstellations(remembered ? remembered === 'on' : root.dataset.constellations === 'on');
    toggle.addEventListener('click', () =>
      showConstellations(root.dataset.constellations !== 'on'),
    );

    const SCALES: Record<string, string[]> = {
      size: ['small', 'medium', 'large'],
      energy: ['low', 'medium', 'high'],
    };
    const chosen: Record<string, string> = { size: 'any', energy: 'any' };
    const fits = (el: Element) =>
      Object.entries(chosen).every(([scale, max]) => {
        if (max === 'any') return true;
        const value = el.getAttribute(`data-${scale}`);
        return value !== null && SCALES[scale].indexOf(value) <= SCALES[scale].indexOf(max);
      });
    const fitText = cfilter.querySelector<HTMLElement>('.al-fit');
    const applyFilter = () => {
      const unfit = new Set<string>();
      let fitting = 0;
      for (const group of root.querySelectorAll('.al-cgroup')) {
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
      if (fitText) fitText.textContent = fitText.dataset.template!.replace('9999', String(fitting));
    };
    cfilter.addEventListener('click', (e) => {
      const button = (e.target as Element).closest<HTMLButtonElement>('.al-scale button');
      if (!button) return;
      const scale = button.parentElement!.dataset.scale!;
      chosen[scale] = button.dataset.value!;
      for (const b of button.parentElement!.querySelectorAll('button')) {
        b.setAttribute('aria-pressed', String(b === button));
      }
      applyFilter();
    });
  }

  /* Selection and the panel. A drag on the sky is not a click on a star. */
  let dragged = false;
  let selected: number | undefined;
  let returnFocus: Element | null = null;
  const starsOf = (n: number) => root.querySelectorAll(`.al-star[data-n="${n}"]`);
  const highlight = (n: number | undefined, cls: string) => {
    for (const el of root.querySelectorAll(`.${cls}`)) el.classList.remove(cls);
    if (n === undefined) return;
    for (const t of root.querySelectorAll(
      `.al-thread[data-from="${n}"], .al-thread[data-to="${n}"]`,
    )) {
      t.classList.add(cls);
    }
  };
  const select = (n: number | undefined, focusPanel = true) => {
    for (const el of root.querySelectorAll('.al-open-panel')) el.classList.remove('al-open-panel');
    for (const el of root.querySelectorAll('.al-selected, .al-near')) {
      el.classList.remove('al-selected', 'al-near');
    }
    selected = n;
    for (const m of maps) m.classList.toggle('al-has-selection', n !== undefined);
    highlight(n, 'al-lit');
    if (n === undefined) {
      history.replaceState(null, '', location.pathname + location.search);
      if (returnFocus instanceof HTMLElement || returnFocus instanceof SVGElement) {
        returnFocus.focus();
      }
      return;
    }
    const panel = document.getElementById(`star-${n}`);
    if (!panel) return;
    panel.classList.add('al-open-panel');
    panel.scrollTop = 0;
    for (const s of starsOf(n)) s.classList.add('al-selected');
    for (const t of root.querySelectorAll(
      `.al-thread[data-from="${n}"], .al-thread[data-to="${n}"]`,
    )) {
      const other = t.getAttribute('data-from') === String(n) ? 'data-to' : 'data-from';
      for (const s of starsOf(Number(t.getAttribute(other)))) s.classList.add('al-near');
    }
    history.replaceState(null, '', `#star-${n}`);
    if (root.dataset.view === 'sky') ensureVisible(n);
    if (focusPanel) panel.focus({ preventScroll: true });
  };

  root.addEventListener('click', (e) => {
    const target = e.target as Element;
    if (target.closest('[data-close]')) {
      e.preventDefault();
      select(undefined);
      return;
    }
    const link = target.closest<Element>('a[href^="#star-"]');
    if (!link) return;
    e.preventDefault();
    if (dragged) return;
    const n = Number(link.getAttribute('href')!.slice('#star-'.length));
    if (link.classList.contains('al-star')) returnFocus = link;
    select(n === selected && link.classList.contains('al-star') ? undefined : n);
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && selected !== undefined) select(undefined);
  });
  for (const m of maps) {
    m.addEventListener('pointerover', (e) => {
      const star = (e.target as Element).closest<Element>('.al-star');
      if (star && selected === undefined) highlight(Number(star.getAttribute('data-n')), 'al-lit');
    });
    m.addEventListener('pointerout', (e) => {
      const star = (e.target as Element).closest('.al-star');
      if (star && selected === undefined) highlight(undefined, 'al-lit');
    });
  }

  /* Pan and zoom on the night sky, by moving its viewBox. */
  const W = Number(sky.dataset.width);
  const H = Number(sky.dataset.height);
  const home = { x: 0, y: 0, w: W, h: H };
  let box = { ...home };
  const apply = () => sky.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`);
  // A tall frame (a phone) fills its height and crops the sides, so the labels stay legible.
  const fill = () => {
    const r = skyView.getBoundingClientRect();
    const tall = r.height > r.width;
    sky.setAttribute('preserveAspectRatio', tall ? 'xMidYMid slice' : 'xMidYMid meet');
  };
  fill();
  new ResizeObserver(fill).observe(skyView);
  const toSky = (clientX: number, clientY: number) => {
    const ctm = sky.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };
  const zoomAt = (clientX: number, clientY: number, factor: number) => {
    const w = Math.min(W * 1.6, Math.max(W / 10, box.w / factor));
    const f = box.w / w;
    const p = toSky(clientX, clientY);
    box = {
      x: p.x - (p.x - box.x) / f,
      y: p.y - (p.y - box.y) / f,
      w,
      h: (box.h * w) / box.w,
    };
    apply();
  };
  const zoomCentre = (factor: number) => {
    const r = sky.getBoundingClientRect();
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
  skyView.addEventListener(
    'wheel',
    (e) => {
      // A plain wheel scrolls the page; a trackpad pinch arrives with ctrlKey set.
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018)));
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
    const ctm = sky.getScreenCTM();
    if (!ctm) return;
    box.x -= (now.x - last.x) / ctm.a;
    box.y -= (now.y - last.y) / ctm.d;
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
    const star = sky.querySelector<SVGGraphicsElement>(`.al-star[data-n="${n}"] g`);
    if (!star) return;
    const r = star.getBoundingClientRect();
    const view = sky.getBoundingClientRect();
    const panel = document.getElementById(`star-${n}`)?.getBoundingClientRect();
    const right = panel && panel.left > view.left + 200 ? panel.left - 20 : view.right - 20;
    const inside =
      r.left > view.left + 20 &&
      r.right < right &&
      r.top > view.top + 20 &&
      r.bottom < view.bottom - 20;
    if (inside) return;
    const target = toSky((view.left + right) / 2, (view.top + view.bottom) / 2);
    const at = toSky(r.left + r.width / 2, r.top + r.height / 2);
    box.x += at.x - target.x;
    box.y += at.y - target.y;
    apply();
  }

  /* Open the star a link points to. */
  const fromHash = /^#star-(\d+)$/.exec(location.hash);
  if (fromHash) select(Number(fromHash[1]), false);
}

/**
 * The page layer of the Astrolabe's state (`state.ts`): it starts the state from the saved
 * entry and the address, wires the controls above the map, saves what is remembered, writes
 * the address, mirrors the state onto the root element for CSS and tells the views.
 */
import {
  act,
  type Action,
  addressOf,
  type AstrolabeState,
  BUILT,
  type FilterChoice,
  SAVED_KEY,
  savedEntry,
  startState,
  type View,
} from './state';
import type { Clustering } from '../lib/questions/clusters';

/** One change of state; `action` is absent for the first render on load. */
export interface Change {
  state: AstrolabeState;
  prev: AstrolabeState;
  action?: Action;
}

export interface Store {
  get(): AstrolabeState;
  dispatch(action: Action): void;
  /** Called on every change, in the order subscribed. */
  subscribe(listener: (change: Change) => void): void;
  /** Renders the state on load; call once every view has subscribed. */
  begin(): void;
}

function readSaved(): string | null {
  try {
    return localStorage.getItem(SAVED_KEY);
  } catch {
    return null;
  }
}

function writeSaved(entry: string): void {
  try {
    localStorage.setItem(SAVED_KEY, entry);
  } catch {
    /* Storage unavailable: nothing is remembered. */
  }
}

export function startStore(root: HTMLElement): Store {
  root.classList.add('al-js');
  const views = root.querySelector<HTMLElement>('.al-views');
  const settled = root.querySelector<HTMLButtonElement>('.al-settled');
  const cfilter = root.querySelector<HTMLElement>('.al-cfilter');
  const choice = cfilter?.querySelector<HTMLElement>('.al-cluster');
  const hasConstellations = !!cfilter && Number(cfilter.dataset.total) > 0;
  const canCluster = hasConstellations && !!root.querySelector('.al-sky-motion');

  if (views) views.hidden = false;
  if (settled) settled.hidden = false;
  if (cfilter && hasConstellations) cfilter.hidden = false;
  if (choice && !canCluster) choice.hidden = true;

  const offers = {
    views: [...(views?.querySelectorAll<HTMLButtonElement>('button[data-view]') ?? [])].map(
      (b) => b.dataset.view as View,
    ),
    canCluster,
    canShowSettled: !!settled,
  };
  let state = startState(readSaved(), location.hash, offers);
  const listeners: ((change: Change) => void)[] = [];

  const press = (buttons: Iterable<HTMLButtonElement>, on: (b: HTMLButtonElement) => boolean) => {
    for (const b of buttons) b.setAttribute('aria-pressed', String(on(b)));
  };
  const mirror = () => {
    root.dataset.view = state.view;
    root.dataset.cluster = state.clustering;
    root.dataset.settled = state.showSettled ? 'all' : 'linked';
    if (views) press(views.querySelectorAll('button'), (b) => b.dataset.view === state.view);
    if (choice) {
      press(choice.querySelectorAll('button'), (b) => b.dataset.cluster === state.clustering);
    }
    settled?.setAttribute('aria-pressed', String(state.showSettled));
    for (const scale of root.querySelectorAll<HTMLElement>('.al-scale')) {
      const chosen = state.filter[scale.dataset.scale as keyof FilterChoice];
      press(scale.querySelectorAll('button'), (b) => b.dataset.value === chosen);
    }
  };

  const store: Store = {
    get: () => state,
    subscribe: (listener) => void listeners.push(listener),
    dispatch(action) {
      const prev = state;
      state = act(prev, action);
      if (state === prev) return;
      const entry = savedEntry(state);
      if (entry !== savedEntry(prev)) writeSaved(entry);
      const address = addressOf(state);
      if (address !== addressOf(prev)) {
        history.replaceState(null, '', address || location.pathname + location.search);
      }
      mirror();
      for (const listener of listeners) listener({ state, prev, action });
    },
    begin() {
      // Arrive already set: nothing fades or flies on load.
      root.classList.add('al-instant');
      mirror();
      for (const listener of listeners) listener({ state, prev: BUILT });
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('al-instant')));
    },
  };

  views?.addEventListener('click', (e) => {
    const button = (e.target as Element).closest<HTMLButtonElement>('button[data-view]');
    if (button) store.dispatch({ type: 'view', view: button.dataset.view as View });
  });
  settled?.addEventListener('click', () =>
    store.dispatch({ type: 'settled', all: !state.showSettled }),
  );
  choice?.addEventListener('click', (e) => {
    const button = (e.target as Element).closest<HTMLButtonElement>('button[data-cluster]');
    if (button) store.dispatch({ type: 'cluster', by: button.dataset.cluster as Clustering });
  });
  cfilter?.addEventListener('click', (e) => {
    const button = (e.target as Element).closest<HTMLButtonElement>('.al-scale button');
    if (!button) return;
    const scale = button.closest<HTMLElement>('.al-scale')!.dataset.scale as keyof FilterChoice;
    store.dispatch({
      type: 'filter',
      scale,
      value: button.dataset.value as FilterChoice[keyof FilterChoice],
    });
  });
  root.addEventListener('click', (e) => {
    if (!(e.target as Element).closest('[data-close]')) return;
    e.preventDefault();
    store.dispatch({ type: 'close' });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') store.dispatch({ type: 'escape' });
  });
  return store;
}

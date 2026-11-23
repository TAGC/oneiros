/**
 * The Astrolabe's page state, as plain data and plain functions: which view shows, the
 * clustering, Show settled, the time and energy filter, the open panel and full screen.
 * The page layer (`state-client.ts`) reads and writes the page; nothing here touches it.
 */
import type { Energy, Size } from '../lib/questions/constellation-format';
import type { Clustering } from '../lib/questions/clusters';

export type View = 'sky' | 'tiers' | 'brass';

/** The time and energy chosen in the filter. */
export interface FilterChoice {
  size: Size | 'any';
  energy: Energy | 'any';
}

export type PanelKind = 'star' | 'constellation';

export interface OpenPanel {
  kind: PanelKind;
  n: number;
}

export interface AstrolabeState {
  view: View;
  /** The view to save: the one last chosen on the page, or the saved one; an address on load never sets it. */
  chosenView: View;
  clustering: Clustering;
  showSettled: boolean;
  filter: FilterChoice;
  panel: OpenPanel | null;
  fullScreen: boolean;
}

/** What this page offers: the Dial and clustering show only when there are constellations. */
export interface PageOffers {
  views: readonly View[];
  canCluster: boolean;
  canShowSettled: boolean;
}

/** The page as built, which is also the page without JavaScript. */
export const BUILT: AstrolabeState = {
  view: 'sky',
  chosenView: 'sky',
  clustering: 'areas',
  showSettled: false,
  filter: { size: 'any', energy: 'any' },
  panel: null,
  fullScreen: false,
};

/** The state on arriving, from the saved entry and the address. */
export function startState(saved: string | null, hash: string, offers: PageOffers): AstrolabeState {
  const state: AstrolabeState = { ...BUILT };
  const remembered = readSaved(saved);
  if (offers.views.includes(remembered.view as View)) {
    state.view = state.chosenView = remembered.view as View;
  }
  if (offers.canCluster && remembered.clustering === 'constellations') {
    state.clustering = 'constellations';
  }
  if (offers.canShowSettled && remembered.showSettled === true) state.showSettled = true;
  const address = readAddress(hash);
  if (address === 'dial')
    return offers.views.includes('brass') ? { ...state, view: 'brass' } : state;
  if (address && (address.kind === 'star' || offers.views.includes('brass'))) {
    return withPanel(state, address);
  }
  return state;
}

export type Action =
  | { type: 'view'; view: View }
  | { type: 'cluster'; by: Clustering }
  | { type: 'settled'; all: boolean }
  | { type: 'filter'; scale: keyof FilterChoice; value: FilterChoice[keyof FilterChoice] }
  | { type: 'open'; panel: OpenPanel }
  /** A click on a panel's own mark: it closes that panel when open, else opens it. */
  | { type: 'toggle'; panel: OpenPanel }
  | { type: 'close' }
  /** Escape closes an open panel first, then leaves full screen. */
  | { type: 'escape' }
  | { type: 'fullScreen'; on: boolean };

/** The state after an action; the same object when nothing changes. */
export function act(state: AstrolabeState, action: Action): AstrolabeState {
  const next = change(state, action);
  if (next.view !== state.view) next.chosenView = next.view;
  return same(state, next) ? state : next;
}

function change(state: AstrolabeState, action: Action): AstrolabeState {
  switch (action.type) {
    case 'view':
      return { ...state, view: action.view };
    case 'cluster':
      return { ...state, clustering: action.by };
    case 'settled':
      return { ...state, showSettled: action.all };
    case 'filter':
      return { ...state, filter: { ...state.filter, [action.scale]: action.value } };
    case 'open':
      return withPanel(state, action.panel);
    case 'toggle':
      return samePanel(state.panel, action.panel)
        ? { ...state, panel: null }
        : withPanel(state, action.panel);
    case 'close':
      return { ...state, panel: null };
    case 'escape':
      if (state.panel) return { ...state, panel: null };
      return { ...state, fullScreen: false };
    case 'fullScreen':
      return { ...state, fullScreen: action.on };
  }
}

function samePanel(a: OpenPanel | null, b: OpenPanel | null): boolean {
  return a === b || (!!a && !!b && a.kind === b.kind && a.n === b.n);
}

function same(a: AstrolabeState, b: AstrolabeState): boolean {
  return (
    a.view === b.view &&
    a.chosenView === b.chosenView &&
    a.clustering === b.clustering &&
    a.showSettled === b.showSettled &&
    a.filter.size === b.filter.size &&
    a.filter.energy === b.filter.energy &&
    samePanel(a.panel, b.panel) &&
    a.fullScreen === b.fullScreen
  );
}

const PREFIX: Record<PanelKind, string> = { star: 'star-', constellation: 'constellation-panel-' };

/** What an address points to: a panel, the Dial, or nothing the Astrolabe knows. */
export function readAddress(hash: string): OpenPanel | 'dial' | null {
  if (hash === '#dial') return 'dial';
  for (const kind of Object.keys(PREFIX) as PanelKind[]) {
    const match = new RegExp(`^#${PREFIX[kind]}(\\d+)$`).exec(hash);
    if (match) return { kind, n: Number(match[1]) };
  }
  return null;
}

/** The address for the state: the open panel's, else the Dial's while it shows, else none. */
export function addressOf(state: AstrolabeState): string {
  if (state.panel) return `#${PREFIX[state.panel.kind]}${state.panel.n}`;
  return state.view === 'brass' ? '#dial' : '';
}

/** The key of the one saved entry. */
export const SAVED_KEY = 'astrolabe';

/** The saved entry: the choices made on the page only. The filter resets on every visit. */
export function savedEntry(state: AstrolabeState): string {
  const { chosenView: view, clustering, showSettled } = state;
  return JSON.stringify({ view, clustering, showSettled });
}

/** Opens a panel, closing any other: a star shows in the sky or tiers, a constellation on the Dial. */
function withPanel(state: AstrolabeState, panel: OpenPanel): AstrolabeState {
  let view = state.view;
  if (panel.kind === 'constellation') view = 'brass';
  else if (view === 'brass') view = 'sky';
  return { ...state, view, panel };
}

/** The saved entry's fields, unchecked; anything unreadable is no entry. */
function readSaved(saved: string | null): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(saved ?? '');
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

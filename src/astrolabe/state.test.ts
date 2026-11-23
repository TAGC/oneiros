import { describe, expect, test } from 'bun:test';
import { act, addressOf, type AstrolabeState, BUILT, savedEntry, startState } from './state';

/** A page with every view and choice available. */
const page = { views: ['sky', 'tiers', 'brass'], canCluster: true, canShowSettled: true } as const;

describe('the state on arriving', () => {
  test('is the page as built when nothing is saved and there is no address', () => {
    expect(startState(null, '', page)).toEqual({
      view: 'sky',
      chosenView: 'sky',
      clustering: 'areas',
      showSettled: false,
      filter: { size: 'any', energy: 'any' },
      panel: null,
      fullScreen: false,
    });
  });

  test('brings back the saved view, clustering and Show settled', () => {
    const saved = '{"view":"tiers","clustering":"constellations","showSettled":true}';
    expect(startState(saved, '', page)).toMatchObject({
      view: 'tiers',
      clustering: 'constellations',
      showSettled: true,
    });
  });

  test('ignores a saved entry that is not JSON or holds unknown values', () => {
    expect(startState('tiers', '', page)).toMatchObject({ view: 'sky' });
    expect(startState('null', '', page)).toMatchObject({ view: 'sky' });
    const odd = '{"view":"moon","clustering":"stars","showSettled":"yes"}';
    expect(startState(odd, '', page)).toMatchObject({
      view: 'sky',
      clustering: 'areas',
      showSettled: false,
    });
  });

  test('ignores a saved choice the page does not offer', () => {
    const saved = '{"view":"brass","clustering":"constellations","showSettled":true}';
    const bare = { views: ['sky', 'tiers'], canCluster: false, canShowSettled: false } as const;
    expect(startState(saved, '', bare)).toMatchObject({
      view: 'sky',
      clustering: 'areas',
      showSettled: false,
    });
  });
});

describe('the address on arriving', () => {
  const onDial = '{"view":"brass","clustering":"areas","showSettled":false}';
  const onTiers = '{"view":"tiers","clustering":"areas","showSettled":false}';

  test('a star opens its panel in the night sky, even when the Dial was saved', () => {
    expect(startState(onDial, '#star-12', page)).toMatchObject({
      view: 'sky',
      panel: { kind: 'star', n: 12 },
    });
  });

  test('a star opens in the tiers when the tiers were saved', () => {
    expect(startState(onTiers, '#star-12', page)).toMatchObject({
      view: 'tiers',
      panel: { kind: 'star', n: 12 },
    });
  });

  test('a constellation opens its panel on the Dial', () => {
    expect(startState(onTiers, '#constellation-panel-3', page)).toMatchObject({
      view: 'brass',
      panel: { kind: 'constellation', n: 3 },
    });
  });

  test('#dial opens the Dial with no panel', () => {
    expect(startState(onTiers, '#dial', page)).toMatchObject({ view: 'brass', panel: null });
  });

  test('a Dial address does nothing on a page without the Dial', () => {
    const bare = { views: ['sky', 'tiers'], canCluster: false, canShowSettled: true } as const;
    for (const hash of ['#dial', '#constellation-panel-3']) {
      expect(startState(onTiers, hash, bare)).toMatchObject({ view: 'tiers', panel: null });
    }
  });

  test('any other address is ignored', () => {
    expect(startState(onTiers, '#star-x', page)).toMatchObject({ view: 'tiers', panel: null });
  });

  test('keeps the saved clustering and Show settled', () => {
    const saved = '{"view":"sky","clustering":"constellations","showSettled":true}';
    expect(startState(saved, '#dial', page)).toMatchObject({
      clustering: 'constellations',
      showSettled: true,
    });
  });
});

describe('changing the state', () => {
  const star = (n: number) => ({ kind: 'star', n }) as const;
  const constellation = (n: number) => ({ kind: 'constellation', n }) as const;
  const at = (changes: Partial<AstrolabeState>): AstrolabeState => ({ ...BUILT, ...changes });

  test('switches the view, the clustering and Show settled', () => {
    expect(act(BUILT, { type: 'view', view: 'tiers' }).view).toBe('tiers');
    expect(act(BUILT, { type: 'cluster', by: 'constellations' }).clustering).toBe('constellations');
    expect(act(BUILT, { type: 'settled', all: true }).showSettled).toBe(true);
  });

  test('sets one scale of the filter and keeps the other', () => {
    const sized = act(BUILT, { type: 'filter', scale: 'size', value: 'small' });
    const both = act(sized, { type: 'filter', scale: 'energy', value: 'high' });
    expect(both.filter).toEqual({ size: 'small', energy: 'high' });
  });

  test('opening a star closes an open constellation', () => {
    const next = act(at({ view: 'tiers', panel: constellation(2) }), {
      type: 'open',
      panel: star(5),
    });
    expect(next.panel).toEqual(star(5));
  });

  test('opening a constellation closes an open star and shows the Dial', () => {
    const next = act(at({ panel: star(5) }), { type: 'open', panel: constellation(2) });
    expect(next).toMatchObject({ view: 'brass', panel: constellation(2) });
  });

  test('a star opened from the Dial leads to the night sky', () => {
    const next = act(at({ view: 'brass', panel: constellation(2) }), {
      type: 'open',
      panel: star(5),
    });
    expect(next).toMatchObject({ view: 'sky', panel: star(5) });
  });

  test('a star opened in the tiers stays in the tiers', () => {
    expect(act(at({ view: 'tiers' }), { type: 'open', panel: star(5) }).view).toBe('tiers');
  });

  test('a toggle on the open panel closes it, and on another opens that one', () => {
    const open = at({ panel: star(5) });
    expect(act(open, { type: 'toggle', panel: star(5) }).panel).toBeNull();
    expect(act(open, { type: 'toggle', panel: star(6) }).panel).toEqual(star(6));
  });

  test('switching the view keeps the open panel', () => {
    expect(act(at({ panel: star(5) }), { type: 'view', view: 'tiers' }).panel).toEqual(star(5));
  });

  test('closes the panel', () => {
    expect(act(at({ panel: star(5) }), { type: 'close' }).panel).toBeNull();
  });

  test('Escape closes an open panel first, then leaves full screen', () => {
    const once = act(at({ panel: star(5), fullScreen: true }), { type: 'escape' });
    expect(once).toMatchObject({ panel: null, fullScreen: true });
    expect(act(once, { type: 'escape' }).fullScreen).toBe(false);
  });

  test('enters and leaves full screen', () => {
    const full = act(BUILT, { type: 'fullScreen', on: true });
    expect(full.fullScreen).toBe(true);
    expect(act(full, { type: 'fullScreen', on: false }).fullScreen).toBe(false);
  });

  test('an action that changes nothing gives back the same state', () => {
    expect(act(BUILT, { type: 'view', view: 'sky' })).toBe(BUILT);
    expect(act(BUILT, { type: 'close' })).toBe(BUILT);
    expect(act(BUILT, { type: 'escape' })).toBe(BUILT);
    expect(act(BUILT, { type: 'filter', scale: 'size', value: 'any' })).toBe(BUILT);
    const open = at({ panel: star(5) });
    expect(act(open, { type: 'open', panel: star(5) })).toBe(open);
  });
});

describe('what is kept', () => {
  const at = (changes: Partial<AstrolabeState>): AstrolabeState => ({ ...BUILT, ...changes });
  const state: AstrolabeState = {
    view: 'tiers',
    chosenView: 'tiers',
    clustering: 'constellations',
    showSettled: true,
    filter: { size: 'small', energy: 'low' },
    panel: { kind: 'star', n: 4 },
    fullScreen: true,
  };

  test('the saved entry brings back the view, clustering and Show settled on the next visit', () => {
    expect(startState(savedEntry(state), '', page)).toEqual({
      ...BUILT,
      view: 'tiers',
      chosenView: 'tiers',
      clustering: 'constellations',
      showSettled: true,
    });
  });

  test('a view an address made on load is not saved', () => {
    const saved = '{"view":"tiers","clustering":"areas","showSettled":false}';
    for (const hash of ['#constellation-panel-3', '#dial', '#star-12']) {
      const arrived = startState(saved, hash, page);
      const toggled = act(arrived, { type: 'settled', all: true });
      expect(JSON.parse(savedEntry(toggled))).toEqual({
        view: 'tiers',
        clustering: 'areas',
        showSettled: true,
      });
    }
  });

  test('a view chosen on the page is saved, even after an address on load', () => {
    const arrived = startState(null, '#constellation-panel-3', page);
    expect(JSON.parse(savedEntry(act(arrived, { type: 'view', view: 'tiers' })))).toMatchObject({
      view: 'tiers',
    });
    const closed = act(at({ view: 'tiers', panel: { kind: 'star', n: 5 } }), {
      type: 'open',
      panel: { kind: 'constellation', n: 2 },
    });
    expect(JSON.parse(savedEntry(closed))).toMatchObject({ view: 'brass' });
  });

  test('the saved entry leaves out the filter, the panel and full screen', () => {
    expect(JSON.parse(savedEntry(state))).toEqual({
      view: 'tiers',
      clustering: 'constellations',
      showSettled: true,
    });
  });

  test('the address names the open panel, and is empty with none', () => {
    expect(addressOf(state)).toBe('#star-4');
    expect(addressOf({ ...state, panel: { kind: 'constellation', n: 2 } })).toBe(
      '#constellation-panel-2',
    );
    expect(addressOf({ ...state, panel: null })).toBe('');
  });

  test('the address names the Dial while it shows with no panel', () => {
    const dial = startState(null, '#dial', page);
    expect(addressOf(dial)).toBe('#dial');
    expect(addressOf(act(dial, { type: 'view', view: 'sky' }))).toBe('');
    const closed = act(at({ view: 'brass', panel: { kind: 'constellation', n: 2 } }), {
      type: 'close',
    });
    expect(addressOf(closed)).toBe('#dial');
  });

  test('an address read back opens the same panel', () => {
    expect(startState(null, addressOf(state), page).panel).toEqual(state.panel);
  });
});

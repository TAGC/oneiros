/**
 * What `client.ts` and `brass-client.ts` share: the time and energy filter's test, and a
 * panel kind that opens from its links and shows whichever panel the state holds.
 */
import type { FilterChoice, PanelKind } from './state';
import type { Store } from './state-client';

/** An element fits when its size and energy are the ones chosen; "any" fits everything. */
export function fitsFilter(el: Element, chosen: FilterChoice): boolean {
  return (Object.entries(chosen) as [keyof FilterChoice, string][]).every(
    ([scale, value]) => value === 'any' || el.getAttribute(`data-${scale}`) === value,
  );
}

export interface PanelOptions {
  /** Panel ids, and the links that open them, are this prefix and a number. */
  prefix: string;
  /** The marks that open panels; a click on the open one's mark closes it. */
  mark: string;
  /** The marks for one number. */
  marksOf(n: number): Iterable<Element>;
  /** The maps that dim the rest while a panel is open. */
  maps: readonly Element[];
  /** Where focus returns when a panel is dismissed. */
  returnFocus(n: number): Element | null | undefined;
  /** Before a link opens or closes a panel; false ignores the click. */
  onLink?(link: Element): boolean;
  onOpen?(n: number): void;
  onClose?(): void;
}

/** Shows this kind's panel while the state holds it, and opens it from its links. */
export function setUpPanel(
  root: HTMLElement,
  store: Store,
  kind: PanelKind,
  options: PanelOptions,
): void {
  const { prefix, mark, maps } = options;
  const numberOf = (panel: { kind: PanelKind; n: number } | null) =>
    panel?.kind === kind ? panel.n : undefined;

  const close = (n: number) => {
    document.getElementById(`${prefix}${n}`)?.classList.remove('al-open-panel');
    for (const el of root.querySelectorAll(`${mark}.al-selected`)) {
      el.classList.remove('al-selected');
    }
    for (const m of maps) m.classList.remove('al-has-selection');
    options.onClose?.();
  };
  const open = (n: number, focusPanel: boolean) => {
    const el = document.getElementById(`${prefix}${n}`);
    if (!el) return;
    el.classList.add('al-open-panel');
    el.scrollTop = 0;
    for (const m of options.marksOf(n)) m.classList.add('al-selected');
    for (const m of maps) m.classList.add('al-has-selection');
    options.onOpen?.(n);
    if (focusPanel) el.focus({ preventScroll: true });
  };

  store.subscribe(({ state, prev, action }) => {
    const was = numberOf(prev.panel);
    const now = numberOf(state.panel);
    if (was === now) return;
    if (was !== undefined) close(was);
    if (now !== undefined) open(now, action !== undefined);
    // Dismissed rather than replaced: focus goes back to where the panel came from.
    if (was !== undefined && !state.panel) {
      const target = options.returnFocus(was);
      if (target instanceof HTMLElement || target instanceof SVGElement) target.focus();
    }
  });

  root.addEventListener('click', (e) => {
    const link = (e.target as Element).closest<Element>(`a[href^="#${prefix}"]`);
    if (!link) return;
    e.preventDefault();
    if (options.onLink?.(link) === false) return;
    const n = Number(link.getAttribute('href')!.slice(prefix.length + 1));
    if (!Number.isInteger(n)) return;
    const panel = { kind, n };
    store.dispatch(link.matches(mark) ? { type: 'toggle', panel } : { type: 'open', panel });
  });
}

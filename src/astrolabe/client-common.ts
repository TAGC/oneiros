/**
 * What `client.ts` and `brass-client.ts` share: remembered settings, the time and energy
 * filter's test, and a panel that opens from a mark and closes by its close link or Escape.
 */
import type { Energy, Size } from '../lib/questions/constellations';

/** A setting remembered in the browser, or null when there is none or no storage. */
export function readSetting(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Remembers a setting in the browser; without storage, nothing is remembered. */
export function writeSetting(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Storage unavailable. */
  }
}

/** The time and energy chosen in the filter. */
export interface FilterChoice {
  size: Size | 'any';
  energy: Energy | 'any';
}

/** What the filter's pressed buttons choose. */
export function readFilter(root: ParentNode): FilterChoice {
  const value = (scale: keyof FilterChoice) =>
    root.querySelector<HTMLButtonElement>(
      `.al-scale[data-scale="${scale}"] button[aria-pressed="true"]`,
    )?.dataset.value ?? 'any';
  return { size: value('size') as FilterChoice['size'], energy: value('energy') as Energy };
}

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

export interface Panel {
  /** The open panel's number. */
  current(): number | undefined;
  open(n: number, focusPanel?: boolean): void;
  /** Closes the panel, leaving the address and focus alone. */
  close(): void;
  /** Closes the panel, clears the address and returns focus. */
  dismiss(): void;
}

export function setUpPanel(root: HTMLElement, options: PanelOptions): Panel {
  const { prefix, mark, maps } = options;
  let current: number | undefined;
  const close = () => {
    if (current !== undefined)
      document.getElementById(`${prefix}${current}`)?.classList.remove('al-open-panel');
    for (const el of root.querySelectorAll(`${mark}.al-selected`))
      el.classList.remove('al-selected');
    for (const m of maps) m.classList.remove('al-has-selection');
    current = undefined;
    options.onClose?.();
  };
  const open = (n: number, focusPanel = true) => {
    const el = document.getElementById(`${prefix}${n}`);
    if (!el) return;
    for (const other of root.querySelectorAll('.al-open-panel'))
      other.classList.remove('al-open-panel');
    close();
    el.classList.add('al-open-panel');
    el.scrollTop = 0;
    for (const m of options.marksOf(n)) m.classList.add('al-selected');
    for (const m of maps) m.classList.add('al-has-selection');
    current = n;
    options.onOpen?.(n);
    history.replaceState(null, '', `#${prefix}${n}`);
    if (focusPanel) el.focus({ preventScroll: true });
  };
  const dismiss = () => {
    const n = current;
    close();
    history.replaceState(null, '', location.pathname + location.search);
    const target = n === undefined ? undefined : options.returnFocus(n);
    if (target instanceof HTMLElement || target instanceof SVGElement) target.focus();
  };

  root.addEventListener('click', (e) => {
    const target = e.target as Element;
    if (target.closest('[data-close]')) {
      e.preventDefault();
      if (current !== undefined) dismiss();
      return;
    }
    const link = target.closest<Element>(`a[href^="#${prefix}"]`);
    if (!link) return;
    e.preventDefault();
    if (options.onLink?.(link) === false) return;
    const n = Number(link.getAttribute('href')!.slice(prefix.length + 1));
    if (n === current && link.matches(mark)) dismiss();
    else open(n);
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && current !== undefined) dismiss();
  });
  return { current: () => current, open, close, dismiss };
}

/**
 * The full screen button on the Astrolabe's map. The stage (the controls above the map and the
 * map's frame) goes full screen by the Fullscreen API, or fills the viewport where there is
 * none. The same button or Escape leaves it. Whether the stage is full is part of the state;
 * Escape reaches it through the state, which closes an open panel first.
 */
import { fullscreenWay } from './fullscreen';
import type { Store } from './state-client';

interface WebkitDocument {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
}

export function setUpFullscreen(root: HTMLElement, store: Store): void {
  const stage = root.querySelector<HTMLElement>('.al-stage');
  const button = stage?.querySelector<HTMLButtonElement>('.al-fullscreen');
  if (!stage || !button) return;
  const doc = document as Document & WebkitDocument;
  const el = stage as HTMLElement & { webkitRequestFullscreen?: () => void };
  const way = fullscreenWay(el, doc);
  button.hidden = false;

  /** True while the stage fills the viewport by itself rather than by the API. */
  let overlaid = false;
  const fullElement = () => doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
  const show = (full: boolean) => {
    stage.classList.toggle('al-full', full);
    document.documentElement.classList.toggle('al-full-page', full && overlaid);
    button.setAttribute('aria-pressed', String(full));
    const label = full ? button.dataset.exit! : button.dataset.enter!;
    button.setAttribute('aria-label', label);
    button.title = label;
    store.dispatch({ type: 'fullScreen', on: full });
  };
  const isFull = () => stage.classList.contains('al-full');
  const overlay = (on: boolean) => {
    overlaid = on;
    show(on);
  };

  const enter = () => {
    // A browser may refuse its full screen (a frame's policy, say), or never answer (some
    // embedded browsers): fill the viewport then.
    if (way === 'native') {
      let answered = false;
      const late = setTimeout(() => {
        if (!answered && fullElement() !== stage) overlay(true);
      }, 800);
      el.requestFullscreen().then(
        () => {
          answered = true;
          clearTimeout(late);
        },
        () => {
          answered = true;
          clearTimeout(late);
          overlay(true);
        },
      );
    } else if (way === 'webkit') el.webkitRequestFullscreen!();
    else overlay(true);
  };
  const exit = () => {
    if (overlaid) overlay(false);
    else if (fullElement() === stage) {
      if (way === 'native') void document.exitFullscreen();
      else doc.webkitExitFullscreen?.();
    }
  };
  const changed = () => {
    if (fullElement() === stage) overlaid = false;
    if (!overlaid) show(fullElement() === stage);
  };
  document.addEventListener('fullscreenchange', changed);
  document.addEventListener('webkitfullscreenchange', changed);

  button.addEventListener('click', () => (isFull() ? exit() : enter()));
  // Leaving by the state (Escape once no panel is open).
  store.subscribe(({ state }) => {
    if (!state.fullScreen && isFull()) exit();
  });
}

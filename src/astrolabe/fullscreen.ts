/** How the Astrolabe's map goes full screen: by the Fullscreen API, or by filling the viewport. */

export type FullscreenWay = 'native' | 'webkit' | 'overlay';

interface Requests {
  requestFullscreen?: unknown;
  webkitRequestFullscreen?: unknown;
}

interface Allows {
  fullscreenEnabled?: boolean;
  webkitFullscreenEnabled?: boolean;
}

/** The API where the page may use it, else a fixed overlay (an iPhone has no API for elements). */
export function fullscreenWay(el: Requests, doc: Allows): FullscreenWay {
  if (typeof el.requestFullscreen === 'function' && doc.fullscreenEnabled) return 'native';
  if (typeof el.webkitRequestFullscreen === 'function' && doc.webkitFullscreenEnabled) {
    return 'webkit';
  }
  return 'overlay';
}

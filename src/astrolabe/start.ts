/** The Astrolabe's one start-up script: the state first, then each view, then the first render. */
import { setUpBrass } from './brass-client';
import { setUpSky } from './client';
import { setUpFullscreen } from './fullscreen-client';
import { startStore } from './state-client';

const root = document.querySelector<HTMLElement>('.astrolabe');
if (root?.querySelector('.al-frame')) {
  const store = startStore(root);
  setUpSky(root, store);
  setUpBrass(root, store);
  setUpFullscreen(root, store);
  store.begin();
}

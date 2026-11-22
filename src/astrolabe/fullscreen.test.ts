import { describe, expect, test } from 'bun:test';
import { fullscreenWay } from './fullscreen';

const request = () => Promise.resolve();

describe('the way the map goes full screen', () => {
  test('uses the Fullscreen API where the page may', () => {
    expect(fullscreenWay({ requestFullscreen: request }, { fullscreenEnabled: true })).toBe(
      'native',
    );
  });

  test('uses the prefixed API of older Safari', () => {
    expect(
      fullscreenWay({ webkitRequestFullscreen: request }, { webkitFullscreenEnabled: true }),
    ).toBe('webkit');
  });

  test('fills the viewport itself where there is no API, as on an iPhone', () => {
    expect(fullscreenWay({}, {})).toBe('overlay');
  });

  test('fills the viewport itself where the API is turned off, as in a frame', () => {
    expect(fullscreenWay({ requestFullscreen: request }, { fullscreenEnabled: false })).toBe(
      'overlay',
    );
  });
});

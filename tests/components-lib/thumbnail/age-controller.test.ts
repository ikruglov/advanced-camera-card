import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThumbnailAgeController } from '../../../src/components-lib/thumbnail/age-controller';
import { ViewFolder, type ViewItem } from '../../../src/view/item';
import {
  callIntersectionHandler,
  callVisibilityHandler,
  createFolder,
  createHASS,
  createLitElement,
  getMockIntersectionObserver,
  IntersectionObserverMock,
} from '../../test-utils';
import { TestViewMedia } from '../../view/test-utils';

// @vitest-environment jsdom
const NOW = new Date('2025-01-15T12:00:00Z');
const controllers: ThumbnailAgeController[] = [];
const hosts: HTMLElement[] = [];

const createThumbnail = (item: ViewItem = new TestViewMedia({ startTime: NOW })) => {
  const host = Object.assign(createLitElement(), {
    hass: createHASS(),
    item: item as ViewItem | undefined,
    show_age: true,
  });
  host.hass.language = 'en';
  document.body.append(host);
  const controller = new ThumbnailAgeController(host);
  hosts.push(host);
  controllers.push(controller);
  return { host, controller };
};

describe('ThumbnailAgeController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
    vi.spyOn(document, 'addEventListener');
    vi.spyOn(document, 'removeEventListener');
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    controllers.splice(0).forEach((controller) => controller.hostDisconnected());
    hosts.splice(0).forEach((host) => host.remove());
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it.each([
    [-60, 'just now'],
    [0, 'just now'],
    [59, 'just now'],
    [60, '1 min. ago'],
    [359, '5 min. ago'],
    [3600, '1 hr. ago'],
    [86400, '1 day ago'],
    [30 * 86400, '1 mo. ago'],
    [365 * 86400, '1 yr. ago'],
  ])('should display %s seconds of age as %s', (seconds, expected) => {
    const { controller } = createThumbnail(
      new TestViewMedia({ startTime: new Date(NOW.getTime() - seconds * 1000) }),
    );
    expect(controller.getAge()).toBe(expected);
  });

  it('should use the current Home Assistant language', () => {
    const { controller, host } = createThumbnail(
      new TestViewMedia({ startTime: new Date('2025-01-15T11:55:00Z') }),
    );
    expect(controller.getAge()).toBe('5 min. ago');
    host.hass.language = 'fr';
    expect(controller.getAge()).toMatch(/^il y a 5\smin$/);
    expect(controller.getAge()).toMatch(/^il y a 5\smin$/);
  });

  it.each([
    new TestViewMedia(),
    new TestViewMedia({ startTime: new Date(NaN) }),
    new ViewFolder(createFolder(), []),
  ])('should omit ages without a valid media timestamp', (item) => {
    const { controller } = createThumbnail(item);
    controller.hostUpdate();
    expect(controller.getAge()).toBeNull();
    expect(IntersectionObserver).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('should omit ages when disabled or no item is available', () => {
    const { controller, host } = createThumbnail();
    host.show_age = false;
    expect(controller.getAge()).toBeNull();
    controller.hostUpdate();
    host.show_age = true;
    host.item = undefined;
    expect(controller.getAge()).toBeNull();
    controller.hostUpdate();
    expect(IntersectionObserver).not.toHaveBeenCalled();
  });

  it('should wait until visible and refresh all visible thumbnails on one timer', async () => {
    const first = createThumbnail();
    const second = createThumbnail();
    first.controller.hostUpdate();
    second.controller.hostUpdate();
    expect(vi.getTimerCount()).toBe(0);
    await callIntersectionHandler(false, 0);
    await callIntersectionHandler(true, 0);
    await callIntersectionHandler(true, 1);
    expect(vi.getTimerCount()).toBe(1);
    vi.mocked(first.host.requestUpdate).mockClear();
    vi.mocked(second.host.requestUpdate).mockClear();

    vi.advanceTimersByTime(60000);
    expect(first.host.requestUpdate).toHaveBeenCalledTimes(2);
    expect(second.host.requestUpdate).toHaveBeenCalledTimes(2);
    expect(first.controller.getAge()).toBe('1 min. ago');

    first.controller.hostUpdate();
    expect(IntersectionObserver).toHaveBeenCalledTimes(2);
    first.controller.hostDisconnected();
    expect(vi.getTimerCount()).toBe(1);
    second.controller.hostDisconnected();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('should pause offscreen and immediately refresh when visible again', async () => {
    const { controller, host } = createThumbnail();
    controller.hostUpdate();
    await callIntersectionHandler(true);
    await callIntersectionHandler(false);
    vi.mocked(host.requestUpdate).mockClear();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60000);
    expect(host.requestUpdate).not.toHaveBeenCalled();
    await callIntersectionHandler(true);
    expect(host.requestUpdate).toHaveBeenCalledOnce();
    expect(controller.getAge()).toBe('1 min. ago');
    expect(vi.getTimerCount()).toBe(1);
  });

  it('should pause while the browser tab is hidden', async () => {
    const { controller, host } = createThumbnail();
    controller.hostUpdate();
    await callIntersectionHandler(true);
    await callVisibilityHandler(false);
    vi.mocked(host.requestUpdate).mockClear();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60000);
    expect(host.requestUpdate).not.toHaveBeenCalled();
    await callVisibilityHandler(true);
    expect(host.requestUpdate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(1);
  });

  it('should release observers and the timer when disabled', async () => {
    const { controller, host } = createThumbnail();
    controller.hostUpdate();
    await callIntersectionHandler(true);
    const observer = getMockIntersectionObserver();
    host.show_age = false;
    controller.hostUpdate();
    expect(observer?.disconnect).toHaveBeenCalled();
    expect(document.removeEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    );
    expect(vi.getTimerCount()).toBe(0);
    expect(controller.getAge()).toBeNull();
  });

  it('should reconnect without accepting stale observer callbacks', async () => {
    const { controller, host } = createThumbnail();
    controller.hostConnected();
    controller.hostUpdate();
    await callIntersectionHandler(true);
    host.remove();
    controller.hostDisconnected();
    controller.hostUpdate();
    vi.mocked(host.requestUpdate).mockClear();
    await callIntersectionHandler(true);
    expect(host.requestUpdate).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);

    document.body.append(host);
    controller.hostConnected();
    expect(host.requestUpdate).toHaveBeenCalledOnce();
    controller.hostUpdate();
    await callIntersectionHandler(true, 1);
    expect(vi.getTimerCount()).toBe(1);
  });
});

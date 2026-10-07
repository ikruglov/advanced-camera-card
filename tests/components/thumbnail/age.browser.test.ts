import { assert, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import { deepQuery } from '../../browser/dom';
import {
  createTestFrigateEvent,
  EVENT_TIME_NEWER,
  mountCardWithFrigate,
} from '../../browser/fake-frigate';
import {
  getMediaViewerMediaURLs,
  getThumbnails,
  waitForThumbnails,
} from '../../browser/test-utils';

describe('Thumbnail age badge', () => {
  it.each([false, true])(
    'should show an age and preserve playback with show_details=%s',
    async (showDetails) => {
      const start = Math.floor(new Date().getTime() / 1000) - 300;
      const { card } = await mountCardWithFrigate(
        [createTestFrigateEvent('event', start)],
        {
          view: { default: 'clips' },
          media_gallery: {
            controls: { thumbnails: { show_age: true, show_details: showDetails } },
          },
        },
      );
      await waitForThumbnails(card, 1);
      const thumbnail = getThumbnails(card.card)[0];
      const badge = await card.waitForRender(
        () => deepQuery<HTMLElement>(thumbnail, '.age'),
        'the thumbnail age badge',
      );
      expect(badge.textContent?.trim()).toBe('5 min. ago');
      expect(
        deepQuery(thumbnail, 'advanced-camera-card-thumbnail-details') !== null,
      ).toBe(showDetails);
      expect(getComputedStyle(badge).pointerEvents).toBe('none');

      card.card.style.setProperty('--ha-font-size-m', '18px');
      card.card.style.setProperty(
        '--advanced-camera-card-control-foreground',
        '#ffffff',
      );
      card.card.style.setProperty(
        '--advanced-camera-card-control-background-transparent',
        'rgba(0, 0, 0, 0.75)',
      );
      const style = getComputedStyle(badge);
      expect(style.fontSize).toBe('18px');
      expect(style.color).toBe('rgb(255, 255, 255)');
      expect(style.backgroundColor).toBe('rgba(0, 0, 0, 0.75)');

      const badgeBounds = badge.getBoundingClientRect();
      const thumbnailBounds = thumbnail.getBoundingClientRect();
      assert(badgeBounds.width > 0);
      await userEvent.click(thumbnail, {
        position: {
          x: badgeBounds.left - thumbnailBounds.left + badgeBounds.width / 2,
          y: badgeBounds.top - thumbnailBounds.top + badgeBounds.height / 2,
        },
      });
      await card.events.waitForFirst('advanced-camera-card:media:loaded');
      await card.waitForSelector('advanced-camera-card-viewer-carousel');
      expect(getMediaViewerMediaURLs(card.card)).toEqual([
        expect.stringContaining('clip.webm?event=event'),
      ]);
    },
  );

  it('should omit the badge by default', async () => {
    const { card } = await mountCardWithFrigate(
      [createTestFrigateEvent('event', EVENT_TIME_NEWER)],
      { view: { default: 'clips' } },
    );
    await waitForThumbnails(card, 1);
    expect(deepQuery(getThumbnails(card.card)[0], '.age')).toBeNull();
  });
});

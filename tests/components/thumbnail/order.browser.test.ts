import { assert, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';

import type { AdvancedCameraCardDrawer } from '../../../src/components/drawer';
import type { AdvancedCameraCardThumbnailCarousel } from '../../../src/components/thumbnail-carousel';
import type { AdvancedCameraCardThumbnail } from '../../../src/components/thumbnail/thumbnail';
import { deepQueryAll } from '../../browser/dom';
import {
  createTestFrigateEvent,
  createTestFrigateReview,
  EVENT_TIME_NEWER,
  EVENT_TIME_OLDER,
  mountCardWithFrigate,
} from '../../browser/fake-frigate';
import {
  clickNextPreviousMedia,
  clickThumbnail,
  getSelectedThumbnail,
  waitForMediaViewerMedia,
  waitForThumbnails,
} from '../../browser/test-utils';

const getItems = (carousel: HTMLElement): AdvancedCameraCardThumbnail[] =>
  deepQueryAll<AdvancedCameraCardThumbnail>(carousel, 'advanced-camera-card-thumbnail');
const getIDs = (carousel: HTMLElement): (string | null | undefined)[] =>
  getItems(carousel).map((thumbnail) => thumbnail.item?.getID());

describe('Thumbnail order', () => {
  it.each(['below', 'right'] as const)(
    'should show newest first in the %s live strip',
    async (mode) => {
      const { card } = await mountCardWithFrigate(
        [],
        {
          live: {
            controls: {
              thumbnails: {
                mode,
                order: 'newest_first',
                show_age: true,
                show_details: false,
              },
            },
          },
        },
        [
          createTestFrigateReview('older', EVENT_TIME_OLDER),
          createTestFrigateReview('newer', EVENT_TIME_NEWER),
        ],
      );
      const carousel = await card.waitForSelector<AdvancedCameraCardThumbnailCarousel>(
        'advanced-camera-card-thumbnail-carousel',
      );
      await card.waitForRender(
        () => (getItems(carousel).length === 2 ? carousel : null),
        'both thumbnails',
      );
      if (mode === 'right') {
        const drawer = await card.waitForSelector<AdvancedCameraCardDrawer>(
          'advanced-camera-card-drawer[location="right"]',
        );
        drawer.open = true;
        await drawer.updateComplete;
      }
      expect(getIDs(carousel)).toEqual(['newer', 'older']);
      const [newer, older] = getItems(carousel);
      const axis = mode === 'below' ? 'x' : 'y';
      await expect
        .poll(
          () =>
            older.getBoundingClientRect()[axis] - newer.getBoundingClientRect()[axis],
        )
        .toBeGreaterThan(0);

      assert(carousel.config);
      carousel.config = { ...carousel.config, order: 'oldest_first' };
      await carousel.updateComplete;
      expect(getIDs(carousel)).toEqual(['older', 'newer']);
    },
  );

  it('should preserve the selected clip and next/previous playback order', async () => {
    const { card } = await mountCardWithFrigate(
      [
        createTestFrigateEvent('older', EVENT_TIME_OLDER),
        createTestFrigateEvent('newer', EVENT_TIME_NEWER),
      ],
      {
        view: { default: 'clips' },
        media_viewer: {
          controls: {
            thumbnails: { mode: 'below', order: 'newest_first', show_details: false },
          },
        },
      },
    );
    await waitForThumbnails(card, 2);
    await clickThumbnail(card.card, 0);
    await waitForMediaViewerMedia(card, 'clip.webm?event=newer');
    const carousel = await card.waitForSelector<AdvancedCameraCardThumbnailCarousel>(
      'advanced-camera-card-thumbnail-carousel',
    );
    expect(getIDs(carousel)).toEqual(['newer', 'older']);
    expect(getSelectedThumbnail(carousel)).toBe(getItems(carousel)[0]);
    await userEvent.click(getItems(carousel)[1]);
    await waitForMediaViewerMedia(card, 'clip.webm?event=older');
    expect(getSelectedThumbnail(carousel)).toBe(getItems(carousel)[1]);
    await clickNextPreviousMedia(card.card, 'right');
    await waitForMediaViewerMedia(card, 'clip.webm?event=newer');
    expect(getSelectedThumbnail(carousel)).toBe(getItems(carousel)[0]);
  });
});

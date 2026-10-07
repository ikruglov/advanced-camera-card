import { describe, expect, it } from 'vitest';

import { ThumbnailCarouselController } from '../../../src/components-lib/thumbnail/carousel-controller';
import { thumbnailCarouselControlsSchema } from '../../../src/config/schema/common/controls/thumbnails';
import { ViewMedia, ViewMediaType } from '../../../src/view/item';

describe('ThumbnailCarouselController', () => {
  const older = new ViewMedia(ViewMediaType.Clip);
  const newer = new ViewMedia(ViewMediaType.Clip);

  it('should preserve query order by default', () => {
    const controller = new ThumbnailCarouselController();
    expect(controller.getItems()).toEqual([]);
    expect(controller.getSelectedIndex()).toBeNull();
    controller.setItems([older, newer]);
    expect(controller.getItems()).toEqual([older, newer]);
    expect(controller.getSelectedIndex(newer)).toBe(1);
  });

  it('should reverse thumbnails without changing the query results or selection', () => {
    const controller = new ThumbnailCarouselController();
    const items = [older, newer];
    controller.setItems(items, 'newest_first');
    expect(controller.getItems()).toEqual([newer, older]);
    expect(items).toEqual([older, newer]);
    expect(controller.getSelectedIndex(newer)).toBe(0);
    expect(controller.getSelectedIndex(older)).toBe(1);
    controller.setItems(items, 'oldest_first');
    expect(controller.getSelectedIndex(older)).toBe(0);
    expect(controller.getSelectedIndex(null)).toBeNull();
    controller.setItems([], 'newest_first');
    expect(controller.getSelectedIndex(newer)).toBeNull();
  });

  it('should validate the optional order configuration', () => {
    expect(thumbnailCarouselControlsSchema.parse({}).order).toBe('oldest_first');
    expect(thumbnailCarouselControlsSchema.parse({ order: 'newest_first' }).order).toBe(
      'newest_first',
    );
    expect(thumbnailCarouselControlsSchema.safeParse({ order: 'invalid' }).success).toBe(
      false,
    );
  });
});

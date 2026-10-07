import type { ThumbnailCarouselControlsConfig } from '../../config/schema/common/controls/thumbnails';
import type { ViewItem } from '../../view/item';

export class ThumbnailCarouselController {
  private _items: ViewItem[] = [];

  public setItems(
    items: ViewItem[],
    order?: ThumbnailCarouselControlsConfig['order'],
  ): void {
    // Reverse only the rendered list; playback uses chronological query results.
    this._items = order === 'newest_first' ? [...items].reverse() : items;
  }

  public getItems(): ViewItem[] {
    return this._items;
  }

  public getSelectedIndex(item?: ViewItem | null): number | null {
    const index = item ? this._items.indexOf(item) : -1;
    return index >= 0 ? index : null;
  }
}

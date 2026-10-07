import { differenceInSeconds } from 'date-fns';
import type { ReactiveController, ReactiveControllerHost } from 'lit';

import type { HomeAssistant } from '../../ha/types';
import { getLanguage, localize } from '../../localize/localize';
import { isValidDate } from '../../utils/basic';
import { Timer } from '../../utils/timer';
import type { ViewItem } from '../../view/item';
import { ViewItemClassifier } from '../../view/item-classifier';
import { VisibilityObserver } from '../visibility-observer';

const THUMBNAIL_AGE_REFRESH_SECONDS = 30;

interface ThumbnailAgeHost extends ReactiveControllerHost, HTMLElement {
  hass?: HomeAssistant;
  item?: ViewItem;
  show_age: boolean;
}

export class ThumbnailAgeController implements ReactiveController {
  // Share one clock across cards and thumbnails, only while badges are visible.
  private static _timer = new Timer();
  private static _subscribers = new Set<ThumbnailAgeController>();

  private _host: ThumbnailAgeHost;
  private _observer: VisibilityObserver | null = null;
  private _formatter: Intl.RelativeTimeFormat | null = null;
  private _language: string | null = null;

  constructor(host: ThumbnailAgeHost) {
    this._host = host;
    host.addController(this);
  }

  public hostConnected(): void {
    this._host.requestUpdate();
  }

  public hostDisconnected(): void {
    this._stopObserving();
  }

  public hostUpdate(): void {
    if (!this._host.isConnected || this._getStartTime() === null) {
      this._stopObserving();
      return;
    }
    if (!this._observer) {
      const observer = new VisibilityObserver(
        (visible) => {
          if (this._observer === observer) {
            this._setSubscribed(visible);
            if (visible) {
              this._host.requestUpdate();
            }
          }
        },
        { emitInitial: true },
      );
      this._observer = observer;
      observer.setRoot(this._host);
    }
  }

  private _stopObserving(): void {
    this._observer?.destroy();
    this._observer = null;
    this._setSubscribed(false);
  }

  private _setSubscribed(subscribed: boolean): void {
    const subscribers = ThumbnailAgeController._subscribers;
    const timer = ThumbnailAgeController._timer;
    if (subscribed) {
      subscribers.add(this);
      if (!timer.isRunning()) {
        timer.startRepeated(THUMBNAIL_AGE_REFRESH_SECONDS, () => {
          for (const controller of subscribers) {
            controller._host.requestUpdate();
          }
        });
      }
    } else {
      subscribers.delete(this);
      if (!subscribers.size) {
        timer.stop();
      }
    }
  }

  private _getStartTime(): Date | null {
    const start =
      this._host.show_age && ViewItemClassifier.isMedia(this._host.item)
        ? this._host.item.getStartTime()
        : null;
    return start && isValidDate(start) ? start : null;
  }

  public getAge(): string | null {
    const start = this._getStartTime();
    if (!start) {
      return null;
    }
    const seconds = Math.max(0, differenceInSeconds(new Date(), start));
    if (seconds < 60) {
      return localize('thumbnail.just_now');
    }

    const language = getLanguage(this._host.hass).replaceAll('_', '-');
    if (!this._formatter || this._language !== language) {
      this._formatter = new Intl.RelativeTimeFormat(language, { style: 'short' });
      this._language = language;
    }
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
      ['year', 365 * 86400],
      ['month', 30 * 86400],
      ['day', 86400],
      ['hour', 3600],
    ];
    for (const [unit, duration] of units) {
      if (seconds >= duration) {
        return this._formatter.format(-Math.floor(seconds / duration), unit);
      }
    }
    return this._formatter.format(-Math.floor(seconds / 60), 'minute');
  }
}

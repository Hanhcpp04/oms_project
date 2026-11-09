import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { Subject, map } from 'rxjs';
import { API_ENDPOINTS } from '../constants/app.constants';
import { API_CONFIG } from '../http/api.config';
import { HttpService } from '../http/http.service';
import { asNumber, unwrapApiResponse } from '../utils/api-response.util';
import { AuthTokenService } from './auth-token.service';
import { NotificationService } from './notification.service';

export type AppNotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export interface AppNotification {
  id: number;
  type: string;
  severity: AppNotificationSeverity;
  title: string;
  message: string;
  entityType?: string;
  entityId?: number;
  linkUrl?: string;
  payloadJson?: string;
  read: boolean;
  readAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiEnvelope<T> {
  data?: T;
}

interface RawPageResponse<T> {
  content?: T[];
  page?: number;
  size?: number;
  pageNumber?: number;
  pageSize?: number;
  totalElements?: number;
  totalPages?: number;
}

interface UnreadCountResponse {
  count?: number;
}

interface MarkAllReadResponse {
  updated?: number;
}

@Injectable({ providedIn: 'root' })
export class AppNotificationService {
  private readonly http = inject(HttpService);
  private readonly apiConfig = inject(API_CONFIG);
  private readonly authTokenService = inject(AuthTokenService);
  private readonly toast = inject(NotificationService);
  private readonly zone = inject(NgZone);

  private readonly notificationsState = signal<AppNotification[]>([]);
  private readonly unreadCountState = signal(0);
  private readonly loadingState = signal(false);
  private readonly eventsSubject = new Subject<AppNotification>();

  private streamAbortController: AbortController | null = null;
  private streamStarted = false;

  readonly notifications = this.notificationsState.asReadonly();
  readonly unreadCount = this.unreadCountState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly hasUnread = computed(() => this.unreadCountState() > 0);
  readonly events$ = this.eventsSubject.asObservable();

  loadLatest(size = 20): void {
    this.loadingState.set(true);
    this.http
      .get<RawPageResponse<AppNotification> | ApiEnvelope<RawPageResponse<AppNotification>>>(
        API_ENDPOINTS.notifications,
        { params: { page: 0, size } }
      )
      .pipe(
        map((response) => unwrapApiResponse(response)),
        map((response) => response.content ?? [])
      )
      .subscribe({
        next: (notifications) => {
          this.notificationsState.set(notifications.map((item) => normalizeNotification(item)));
          this.loadingState.set(false);
        },
        error: () => this.loadingState.set(false)
      });
  }

  loadUnreadCount(): void {
    this.http
      .get<UnreadCountResponse | ApiEnvelope<UnreadCountResponse>>(
        `${API_ENDPOINTS.notifications}/unread-count`
      )
      .pipe(map((response) => unwrapApiResponse(response)))
      .subscribe({
        next: (response) => this.unreadCountState.set(asNumber(response.count, 0))
      });
  }

  connect(): void {
    if (this.streamStarted) {
      return;
    }

    this.streamStarted = true;
    const controller = new AbortController();
    this.streamAbortController = controller;
    let stopped = false;

    const connectLoop = async (): Promise<void> => {
      while (!stopped) {
        const token = this.authTokenService.getAccessToken();

        if (!token) {
          await this.waitBeforeReconnect(controller.signal);
          continue;
        }

        try {
          const response = await fetch(this.buildUrl(`${API_ENDPOINTS.notifications}/stream`), {
            method: 'GET',
            headers: {
              Accept: 'text/event-stream',
              Authorization: `Bearer ${token}`
            },
            signal: controller.signal
          });

          if (!response.ok || !response.body) {
            throw new Error(`Notification stream failed with status ${response.status}`);
          }

          await this.readStream(response.body, controller.signal, () => stopped);
        } catch (error) {
          if (!stopped) {
            console.warn('[notifications] stream disconnected', error);
          }
        }

        if (!stopped) {
          await this.waitBeforeReconnect(controller.signal);
        }
      }
    };

    this.zone.runOutsideAngular(() => {
      void connectLoop();
    });

    controller.signal.addEventListener('abort', () => {
      stopped = true;
    });
  }

  disconnect(): void {
    this.streamStarted = false;
    this.streamAbortController?.abort();
    this.streamAbortController = null;
  }

  markRead(notification: AppNotification): void {
    if (notification.read) {
      return;
    }

    this.http
      .patch<AppNotification | ApiEnvelope<AppNotification>, Record<string, never>>(
        `${API_ENDPOINTS.notifications}/${notification.id}/read`,
        {}
      )
      .pipe(map((response) => normalizeNotification(unwrapApiResponse(response))))
      .subscribe({
        next: (updated) => this.replaceNotification(updated)
      });
  }

  markAllRead(): void {
    this.http
      .patch<MarkAllReadResponse | ApiEnvelope<MarkAllReadResponse>, Record<string, never>>(
        `${API_ENDPOINTS.notifications}/read-all`,
        {}
      )
      .pipe(map((response) => unwrapApiResponse(response)))
      .subscribe({
        next: () => {
          this.notificationsState.update((notifications) =>
            notifications.map((notification) => ({ ...notification, read: true }))
          );
          this.unreadCountState.set(0);
        }
      });
  }

  private async readStream(
    body: ReadableStream<Uint8Array>,
    signal: AbortSignal,
    isStopped: () => boolean
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (!isStopped() && !signal.aborted) {
        const chunk = await reader.read();

        if (chunk.done) {
          break;
        }

        buffer += decoder.decode(chunk.value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? '';

        for (const block of blocks) {
          const notification = this.parseNotificationBlock(block);

          if (notification) {
            this.zone.run(() => this.addIncoming(notification));
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private parseNotificationBlock(block: string): AppNotification | null {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
      .trim();

    if (!data) {
      return null;
    }

    try {
      const parsed = JSON.parse(data) as Partial<AppNotification> & { type?: string };

      if (!parsed.id || parsed.type === 'CONNECTED') {
        return null;
      }

      return normalizeNotification(parsed as AppNotification);
    } catch {
      return null;
    }
  }

  private addIncoming(notification: AppNotification): void {
    this.notificationsState.update((current) => {
      const withoutDuplicate = current.filter((item) => item.id !== notification.id);
      return [notification, ...withoutDuplicate].slice(0, 20);
    });

    if (!notification.read) {
      this.unreadCountState.update((count) => count + 1);
    }

    this.eventsSubject.next(notification);
    this.showToast(notification);
  }

  private replaceNotification(updated: AppNotification): void {
    this.notificationsState.update((notifications) =>
      notifications.map((notification) => (notification.id === updated.id ? updated : notification))
    );
    this.loadUnreadCount();
  }

  private showToast(notification: AppNotification): void {
    switch (notification.severity) {
      case 'SUCCESS':
        this.toast.success(notification.message);
        break;
      case 'WARNING':
        this.toast.warning(notification.message);
        break;
      case 'ERROR':
        this.toast.error(notification.message);
        break;
      default:
        this.toast.info(notification.message);
    }
  }

  private async waitBeforeReconnect(signal: AbortSignal): Promise<void> {
    await new Promise<void>((resolve) => {
      let timeoutId: ReturnType<typeof setTimeout>;
      const onAbort = (): void => {
        window.clearTimeout(timeoutId);
        resolve();
      };

      timeoutId = window.setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, 5000);

      signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  private buildUrl(endpoint: string): string {
    const baseUrl = this.apiConfig.baseUrl.replace(/\/+$/, '');
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    return `${baseUrl}${normalizedEndpoint}`;
  }
}

function normalizeNotification(raw: AppNotification): AppNotification {
  return {
    id: asNumber(raw.id, 0),
    type: raw.type,
    severity: raw.severity || 'INFO',
    title: raw.title || '',
    message: raw.message || '',
    entityType: raw.entityType,
    entityId: raw.entityId,
    linkUrl: raw.linkUrl,
    payloadJson: raw.payloadJson,
    read: Boolean(raw.read),
    readAt: raw.readAt,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt
  };
}

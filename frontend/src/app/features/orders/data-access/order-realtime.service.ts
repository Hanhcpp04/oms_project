import { Injectable, NgZone, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_CONFIG } from '../../../core/http/api.config';
import { AuthTokenService } from '../../../core/services/auth-token.service';

export interface OrderRealtimeEvent {
  type: 'ORDER_CREATED_FROM_MESSENGER' | 'CONNECTED' | string;
  orderId?: number;
  draftId?: number;
  customerPsid?: string;
  source?: string;
}

@Injectable({ providedIn: 'root' })
export class OrderRealtimeService {
  private readonly apiConfig = inject(API_CONFIG);
  private readonly authTokenService = inject(AuthTokenService);
  private readonly zone = inject(NgZone);

  stream(): Observable<OrderRealtimeEvent> {
    return new Observable<OrderRealtimeEvent>((subscriber) => {
      if (typeof window === 'undefined') {
        subscriber.complete();
        return undefined;
      }

      const controller = new AbortController();
      let stopped = false;

      const connect = async (): Promise<void> => {
        while (!stopped) {
          const token = this.authTokenService.getAccessToken();

          if (!token) {
            await this.waitBeforeReconnect(controller.signal);
            continue;
          }

          try {
            const response = await fetch(this.buildUrl('/orders/realtime/stream'), {
              method: 'GET',
              headers: {
                Accept: 'text/event-stream',
                Authorization: `Bearer ${token}`
              },
              signal: controller.signal
            });

            if (!response.ok || !response.body) {
              throw new Error(`Order realtime stream failed with status ${response.status}`);
            }

            await this.readStream(response.body, subscriber, controller.signal, () => stopped);
          } catch (error) {
            if (!stopped) {
              console.warn('[orders-realtime] stream disconnected', error);
            }
          }

          if (!stopped) {
            await this.waitBeforeReconnect(controller.signal);
          }
        }
      };

      this.zone.runOutsideAngular(() => {
        void connect();
      });

      return () => {
        stopped = true;
        controller.abort();
      };
    });
  }

  private async readStream(
    body: ReadableStream<Uint8Array>,
    subscriber: { next: (value: OrderRealtimeEvent) => void },
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
          const event = this.parseEventBlock(block);

          if (event) {
            this.zone.run(() => subscriber.next(event));
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private parseEventBlock(block: string): OrderRealtimeEvent | null {
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
      return JSON.parse(data) as OrderRealtimeEvent;
    } catch {
      return null;
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

import { DOCUMENT } from '@angular/common';
import { inject, Injectable, NgZone } from '@angular/core';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
          }) => void;
          prompt: (callback?: (notification: any) => void) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
        };
      };
    };
  }
}

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private readonly document = inject(DOCUMENT);
  private readonly ngZone = inject(NgZone);
  private scriptLoadingPromise: Promise<void> | null = null;

  async renderButton(clientId: string, element: HTMLElement, options: any = {}): Promise<string> {
    if (!clientId.trim()) {
      throw new Error('Google client ID is not configured.');
    }

    await this.loadScript();

    return new Promise<string>((resolve, reject) => {
      const googleAccounts = window.google?.accounts?.id;

      if (!googleAccounts) {
        reject(new Error('Google Identity Services is unavailable.'));
        return;
      }

      googleAccounts.initialize({
        client_id: clientId,
        callback: (response) => {
          this.ngZone.run(() => {
            if (!response.credential) {
              reject(new Error('Google credential was not returned.'));
              return;
            }
            resolve(response.credential);
          });
        }
      });

      googleAccounts.renderButton(element, { theme: 'outline', size: 'large', type: 'standard', ...options });
    });
  }

  private loadScript(): Promise<void> {
    if (window.google?.accounts?.id) {
      return Promise.resolve();
    }

    if (this.scriptLoadingPromise) {
      return this.scriptLoadingPromise;
    }

    this.scriptLoadingPromise = new Promise<void>((resolve, reject) => {
      const existingScript = this.document.getElementById('google-identity-script') as HTMLScriptElement | null;

      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Identity script.')), {
          once: true
        });
        return;
      }

      const script = this.document.createElement('script');
      script.id = 'google-identity-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Identity script.'));
      this.document.head.appendChild(script);
    });

    return this.scriptLoadingPromise;
  }
}

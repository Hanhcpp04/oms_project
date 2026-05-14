import { Injectable } from '@angular/core';
import { STORAGE_KEYS } from '../constants/app.constants';

@Injectable({ providedIn: 'root' })
export class AuthTokenService {
  getAccessToken(): string | null {
    return this.storage?.getItem(STORAGE_KEYS.accessToken) ?? null;
  }

  getRefreshToken(): string | null {
    return this.storage?.getItem(STORAGE_KEYS.refreshToken) ?? null;
  }

  setTokens(accessToken: string, refreshToken?: string): void {
    this.storage?.setItem(STORAGE_KEYS.accessToken, accessToken);

    if (refreshToken) {
      this.storage?.setItem(STORAGE_KEYS.refreshToken, refreshToken);
    }
  }

  clearTokens(): void {
    this.storage?.removeItem(STORAGE_KEYS.accessToken);
    this.storage?.removeItem(STORAGE_KEYS.refreshToken);
  }

  private get storage(): Storage | null {
    if (typeof window === 'undefined') {
      return null;
    }

    return window.localStorage;
  }
}
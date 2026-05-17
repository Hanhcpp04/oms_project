import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_ENDPOINTS } from '../constants/app.constants';
import { HttpService } from '../http/http.service';
import { AuthSession, GoogleAuthPayload, LoginCredentials, RegisterPayload } from './auth.models';

interface ApiEnvelope<T> {
  data?: T;
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly httpService = inject(HttpService);

  login(payload: LoginCredentials): Observable<AuthSession> {
    return this.httpService
      .post<ApiEnvelope<BackendAuthSession>, LoginCredentials>(API_ENDPOINTS.auth.login, payload)
      .pipe(map((response) => normalizeAuthSession(response.data)));
  }

  register(payload: RegisterPayload): Observable<AuthSession> {
    return this.httpService
      .post<ApiEnvelope<BackendAuthSession>, RegisterPayload>(API_ENDPOINTS.auth.register, payload)
      .pipe(map((response) => normalizeAuthSession(response.data)));
  }

  /**
   * Unified Google authentication (auto-login or auto-register).
   */
  googleAuth(payload: GoogleAuthPayload): Observable<AuthSession> {
    return this.httpService
      .post<ApiEnvelope<BackendAuthSession>, GoogleAuthPayload>(API_ENDPOINTS.auth.google, payload)
      .pipe(map((response) => normalizeAuthSession(response.data)));
  }

  me(): Observable<AuthSession> {
    return this.httpService
      .get<ApiEnvelope<BackendAuthSession>>(API_ENDPOINTS.auth.me)
      .pipe(map((response) => normalizeAuthSession(response.data)));
  }

  refresh(refreshToken: string): Observable<AuthSession> {
    return this.httpService
      .post<ApiEnvelope<BackendAuthSession>, { refreshToken: string }>(API_ENDPOINTS.auth.refresh, { refreshToken })
      .pipe(map((response) => normalizeAuthSession(response.data)));
  }

  logout(refreshToken: string): Observable<void> {
    return this.httpService
      .post<ApiEnvelope<void>, { refreshToken: string }>(API_ENDPOINTS.auth.logout, { refreshToken })
      .pipe(map(() => undefined));
  }

  createShopProfile(payload: { shopName: string; email?: string; phone?: string; logoUrl?: string }): Observable<AuthSession> {
    return this.httpService
      .post<ApiEnvelope<BackendAuthSession>, any>('/shops/onboarding/profile', payload)
      .pipe(map((response) => normalizeAuthSession(response.data)));
  }

  updateBusinessType(payload: { enableSell: boolean; enableRent: boolean }): Observable<AuthSession> {
    return this.httpService
      .post<ApiEnvelope<BackendAuthSession>, any>('/shops/onboarding/business-type', payload)
      .pipe(map((response) => normalizeAuthSession(response.data)));
  }

  saveCategories(categories: string[]): Observable<AuthSession> {
    return this.httpService
      .post<ApiEnvelope<BackendAuthSession>, any>('/shops/onboarding/categories', { categories })
      .pipe(map((response) => normalizeAuthSession(response.data)));
  }

  updateCategories(categories: string[]): Observable<AuthSession> {
    return this.httpService
      .post<ApiEnvelope<BackendAuthSession>, any>('/shops/categories', { categories })
      .pipe(map((response) => normalizeAuthSession(response.data)));
  }

  completeOnboarding(): Observable<AuthSession> {
    return this.httpService
      .post<ApiEnvelope<BackendAuthSession>, any>('/shops/onboarding/complete', {})
      .pipe(map((response) => normalizeAuthSession(response.data)));
  }

  updateBasicInfo(payload: any): Observable<AuthSession> {
    return this.httpService
      .post<ApiEnvelope<BackendAuthSession>, any>('/shops/basic-info', payload)
      .pipe(map((response) => normalizeAuthSession(response.data)));
  }

  updateSupportInfo(payload: any): Observable<AuthSession> {
    return this.httpService
      .post<ApiEnvelope<BackendAuthSession>, any>('/shops/support-info', payload)
      .pipe(map((response) => normalizeAuthSession(response.data)));
  }

  updateLogo(payload: any): Observable<AuthSession> {
    return this.httpService
      .post<ApiEnvelope<BackendAuthSession>, any>('/shops/logo', payload)
      .pipe(map((response) => normalizeAuthSession(response.data)));
  }

  updateAddresses(payload: any): Observable<AuthSession> {
    return this.httpService
      .post<ApiEnvelope<BackendAuthSession>, any>('/shops/addresses/bulk', payload)
      .pipe(map((response) => normalizeAuthSession(response.data)));
  }

  updateOperationalSettings(payload: any): Observable<AuthSession> {
    return this.httpService
      .post<ApiEnvelope<BackendAuthSession>, any>('/shops/settings', payload)
      .pipe(map((response) => normalizeAuthSession(response.data)));
  }

  changePassword(payload: any): Observable<void> {
    return this.httpService
      .post<ApiEnvelope<void>, any>('/auth/change-password', payload)
      .pipe(map(() => undefined));
  }

  updateProfile(payload: { fullName: string; email?: string; phone?: string }): Observable<AuthSession> {
    return this.httpService
      .post<ApiEnvelope<BackendAuthSession>, any>('/auth/update-profile', payload)
      .pipe(map((response) => normalizeAuthSession(response.data)));
  }
}

interface BackendAuthSession {
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  user?: {
    id?: number | string;
    fullName?: string;
    email?: string;
    role?: string;
    forceChangePassword?: boolean;
  };
  shop?: {
    id?: number | string;
    name?: string;
    slug?: string;
    avatarUrl?: string;
    email?: string;
    phone?: string;
    supportEmail?: string;
    supportPhone?: string;
    businessMode?: string;
    status?: string;
    enableSell?: boolean;
    enableRent?: boolean;
    autoAcceptOrders?: boolean;
    maintenanceMode?: boolean;
    showInventoryOnStorefront?: boolean;
    notificationsEnabled?: boolean;
    rentalIdentityVerificationEnabled?: boolean;
    categories?: string[];
    addresses?: any[];
  } | null;
  onboarding?: {
    completed?: boolean;
    currentStep?: string;
  } | null;
}

function normalizeAuthSession(payload: BackendAuthSession | undefined): AuthSession {
  const session = payload ?? {};
  const user = session.user ?? {};

  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    tokenType: session.tokenType,
    user: {
      id: asString(user.id),
      fullName: user.fullName?.trim() || 'OMS User',
      email: user.email?.trim() || '',
      role: mapToAppRole(user.role),
      forceChangePassword: Boolean(user.forceChangePassword)
    },
    shop: session.shop
      ? {
          id: asString(session.shop.id),
          name: session.shop.name?.trim() || 'Shop',
          slug: session.shop.slug?.trim() || '',
          avatarUrl: session.shop.avatarUrl?.trim() || undefined,
          status: session.shop.status?.trim() || 'ACTIVE',
          enableSell: Boolean(session.shop.enableSell ?? true),
          enableRent: Boolean(session.shop.enableRent ?? true),
          email: session.shop.email,
          phone: session.shop.phone,
          supportEmail: session.shop.supportEmail,
          supportPhone: session.shop.supportPhone,
          businessMode: resolveBusinessMode(session.shop),
          maintenanceMode: Boolean(session.shop.maintenanceMode ?? false),
          autoAcceptOrders: Boolean(session.shop.autoAcceptOrders ?? false),
          showInventoryOnStorefront: Boolean(session.shop.showInventoryOnStorefront ?? true),
          notificationsEnabled: Boolean(session.shop.notificationsEnabled ?? true),
          rentalIdentityVerificationEnabled: Boolean(session.shop.rentalIdentityVerificationEnabled ?? false),
          categories: session.shop.categories || [],
          addresses: session.shop.addresses || []
        }
      : null,
    onboarding: session.onboarding
      ? {
          completed: Boolean(session.onboarding.completed),
          currentStep: session.onboarding.currentStep?.trim() || 'SHOP_PROFILE'
        }
      : null
  };
}

function mapToAppRole(role: string | undefined): 'SHOP_OWNER' | 'STAFF' {
  switch (role) {
    case 'OWNER':
    case 'ADMIN':
    case 'SHOP_OWNER':
      return 'SHOP_OWNER';
    default:
      return 'STAFF';
  }
}

function resolveBusinessMode(shop: NonNullable<BackendAuthSession['shop']>): string {
  const enableSell = Boolean(shop.enableSell ?? true);
  const enableRent = Boolean(shop.enableRent ?? true);

  if (enableSell && enableRent) {
    return 'BOTH';
  }

  return enableSell ? 'SELL' : 'RENT';
}

function asString(value: string | number | undefined): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  return '';
}

import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { STORAGE_KEYS } from '../constants/app.constants';
import { NotificationService } from '../services/notification.service';
import { PermissionService } from '../services/permission.service';
import { AuthTokenService } from '../services/auth-token.service';
import { ShopSetupStatusService } from '../services/shop-setup-status.service';
import { AuthApiService } from './auth-api.service';
import { AppRole, AuthOnboarding, AuthSession, AuthShop, AuthUser, GoogleAuthPayload, LoginCredentials, RegisterPayload } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly authApiService = inject(AuthApiService);
  private readonly authTokenService = inject(AuthTokenService);
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);
  private readonly router = inject(Router);
  private readonly shopSetupStatusService = inject(ShopSetupStatusService);

  private readonly userState = signal<AuthUser | null>(null);
  private readonly shopState = signal<AuthShop | null>(null);
  private readonly onboardingState = signal<AuthOnboarding | null>(null);
  private readonly initializedState = signal(false);
  private readonly loadingSessionState = signal(false);
  private readonly submittingAuthState = signal(false);

  readonly currentUser = this.userState.asReadonly();
  readonly currentShop = this.shopState.asReadonly();
  readonly onboarding = this.onboardingState.asReadonly();
  readonly currentRole = computed<AppRole | null>(() => this.userState()?.role ?? null);
  readonly isAuthenticated = computed(() => this.userState() !== null);
  readonly loadingSession = this.loadingSessionState.asReadonly();
  readonly submittingAuth = this.submittingAuthState.asReadonly();

  hasRole(role: AppRole): boolean {
    return this.currentRole() === role;
  }

  hasAnyRole(roles: AppRole[]): boolean {
    const current = this.currentRole();
    return current !== null && roles.includes(current);
  }

  loadCurrentUser(force = false): void {
    if (this.loadingSessionState()) {
      return;
    }

    if (this.initializedState() && !force) {
      return;
    }

    const persisted = this.restoreSession();
    if (persisted) {
      this.applySession(persisted, false);
    }

    const token = this.authTokenService.getAccessToken();
    if (!token) {
      this.initializedState.set(true);
      if (!persisted) {
        this.clearSession(false);
      }
      return;
    }

    this.loadingSessionState.set(true);

    this.authApiService
      .me()
      .pipe(finalize(() => {
        this.loadingSessionState.set(false);
        this.initializedState.set(true);
      }))
      .subscribe({
        next: (session) => this.applySession(session, false),
        error: () => this.tryRefreshSession()
      });
  }

  login(payload: LoginCredentials, options?: { redirectTo?: string }): void {
    this.submittingAuthState.set(true);

    this.authApiService
      .login(payload)
      .pipe(finalize(() => this.submittingAuthState.set(false)))
      .subscribe({
        next: (session) => {
          this.applySession(session, true);
          this.navigateAfterAuth(options?.redirectTo);
        }
      });
  }

  register(payload: RegisterPayload): void {
    this.submittingAuthState.set(true);

    this.authApiService
      .register(payload)
      .pipe(finalize(() => this.submittingAuthState.set(false)))
      .subscribe({
        next: (session) => {
          this.applySession(session, true);
          this.notificationService.success('Dang ky thanh cong.');
          this.navigateAfterAuth(undefined, { registered: 'success' });
        }
      });
  }

  loginWithGoogle(payload: GoogleAuthPayload, options?: { redirectTo?: string }): void {
    this.submittingAuthState.set(true);

    this.authApiService
      .googleAuth(payload)
      .pipe(finalize(() => this.submittingAuthState.set(false)))
      .subscribe({
        next: (session) => {
          this.applySession(session, true);
          this.navigateAfterAuth(options?.redirectTo);
        }
      });
  }

  registerWithGoogle(payload: GoogleAuthPayload): void {
    this.submittingAuthState.set(true);

    this.authApiService
      .googleAuth(payload)
      .pipe(finalize(() => this.submittingAuthState.set(false)))
      .subscribe({
        next: (session) => {
          this.applySession(session, true);
          this.notificationService.success('Dang ky bang Google thanh cong.');
          this.navigateAfterAuth(undefined, { registered: 'success' });
        }
      });
  }

  logout(): void {
    const refreshToken = this.authTokenService.getRefreshToken();

    if (!refreshToken) {
      this.clearSession(true);
      return;
    }

    this.authApiService.logout(refreshToken).subscribe({
      next: () => this.clearSession(true),
      error: () => this.clearSession(true)
    });
  }

  needsShopSetup(): boolean {
    return this.currentRole() === 'SHOP_OWNER' &&
           (
             !this.shopState() ||
             !this.onboardingState() ||
             !this.onboardingState()?.completed
           );
  }

  needsShopCreation(): boolean {
    return this.currentRole() === 'SHOP_OWNER' && !this.shopState();
  }

  needsPasswordChange(): boolean {
    return Boolean(this.userState()?.forceChangePassword);
  }

  changePassword(currentPassword: string, newPassword: string): void {
    this.submittingAuthState.set(true);
    this.authApiService
      .changePassword({ currentPassword, newPassword })
      .pipe(finalize(() => this.submittingAuthState.set(false)))
      .subscribe({
        next: () => {
          this.notificationService.success('Đổi mật khẩu thành công.');
          this.loadCurrentUser(true);
        }
      });
  }

  completeProfile(payload: { fullName: string; email: string; phone: string; currentPassword: string; newPassword: string }): void {
    this.submittingAuthState.set(true);
    
    // First update profile
    this.authApiService.updateProfile({
      fullName: payload.fullName,
      email: payload.email,
      phone: payload.phone
    }).subscribe({
      next: (session) => {
        this.applySession(session, false);
        
        // Then change password
        this.authApiService.changePassword({
          currentPassword: payload.currentPassword,
          newPassword: payload.newPassword
        }).pipe(finalize(() => this.submittingAuthState.set(false)))
        .subscribe({
          next: () => {
            this.notificationService.success('Cập nhật hồ sơ và đổi mật khẩu thành công.');
            this.loadCurrentUser(true);
            void this.router.navigate(['/app']);
          }
        });
      },
      error: (err) => {
        this.submittingAuthState.set(false);
        this.notificationService.error('Không thể cập nhật hồ sơ: ' + (err.error?.message || 'Lỗi hệ thống'));
      }
    });
  }

  createShopProfile(payload: { shopName: string; email?: string; phone?: string; logoUrl?: string }): void {
    this.submittingAuthState.set(true);
    this.authApiService
      .createShopProfile(payload)
      .pipe(finalize(() => this.submittingAuthState.set(false)))
      .subscribe({
        next: (session) => {
          this.applySession(session, false);
          this.notificationService.success('Đã tạo shop. Bạn có thể hoàn tất thiết lập trong trang quản trị.');
          this.shopSetupStatusService.refresh();
          void this.router.navigate(['/app']);
        }
      });
  }

  updateBusinessType(payload: { enableSell: boolean; enableRent: boolean }): void {
    this.submittingAuthState.set(true);
    this.authApiService
      .updateBusinessType(payload)
      .pipe(finalize(() => this.submittingAuthState.set(false)))
      .subscribe({
        next: (session) => {
          this.applySession(session, false);
          this.notificationService.success('Đã lưu mô hình kinh doanh. Chuyển sang bước 3.');
          void this.router.navigate(['/shop-setup/category']);
        }
      });
  }

  updateBusinessTypeSettings(payload: { enableSell: boolean; enableRent: boolean }): void {
    this.submittingAuthState.set(true);
    this.authApiService
      .updateBusinessType(payload)
      .pipe(finalize(() => this.submittingAuthState.set(false)))
      .subscribe({
        next: (session) => {
          this.applySession(session, false);
          this.shopSetupStatusService.refresh();
          this.notificationService.success('Đã cập nhật mô hình kinh doanh.');
        }
      });
  }

  saveCategories(categories: string[]): void {
    this.submittingAuthState.set(true);
    this.authApiService
      .saveCategories(categories)
      .pipe(finalize(() => this.submittingAuthState.set(false)))
      .subscribe({
        next: (session) => {
          this.applySession(session, false);
          // Auto-complete onboarding after saving categories in the stepper
          this.completeOnboarding();
        }
      });
  }

  updateCategoriesSettings(categories: string[]): void {
    this.submittingAuthState.set(true);
    this.authApiService
      .updateCategories(categories)
      .pipe(finalize(() => this.submittingAuthState.set(false)))
      .subscribe({
        next: (session) => {
          this.applySession(session, false);
          this.shopSetupStatusService.refresh();
          this.notificationService.success('Đã cập nhật danh mục.');
        }
      });
  }

  completeOnboarding(): void {
    this.submittingAuthState.set(true);
    this.authApiService
      .completeOnboarding()
      .pipe(finalize(() => this.submittingAuthState.set(false)))
      .subscribe({
        next: (session) => {
          this.applySession(session, false);
          this.shopSetupStatusService.refresh();
          this.notificationService.success('Chúc mừng! Bạn đã hoàn tất thiết lập shop.');
          void this.router.navigate(['/app']);
        }
      });
  }

  updateBasicInfo(payload: any): void {
    this.submittingAuthState.set(true);
    this.authApiService
      .updateBasicInfo(payload)
      .pipe(finalize(() => this.submittingAuthState.set(false)))
      .subscribe({
        next: (session) => {
          this.applySession(session, false);
          this.shopSetupStatusService.refresh();
          this.notificationService.success('Đã cập nhật thông tin cơ bản.');
        }
      });
  }

  updateSupportInfo(payload: any): void {
    this.submittingAuthState.set(true);
    this.authApiService
      .updateSupportInfo(payload)
      .pipe(finalize(() => this.submittingAuthState.set(false)))
      .subscribe({
        next: (session) => {
          this.applySession(session, false);
          this.shopSetupStatusService.refresh();
          this.notificationService.success('Đã cập nhật thông tin hỗ trợ.');
        }
      });
  }

  updateLogo(payload: any): void {
    this.submittingAuthState.set(true);
    this.authApiService
      .updateLogo(payload)
      .pipe(finalize(() => this.submittingAuthState.set(false)))
      .subscribe({
        next: (session) => {
          this.applySession(session, false);
          this.shopSetupStatusService.refresh();
          this.notificationService.success('Đã cập nhật logo shop.');
        }
      });
  }

  updateAddresses(payload: any): void {
    this.submittingAuthState.set(true);
    this.authApiService
      .updateAddresses(payload)
      .pipe(finalize(() => this.submittingAuthState.set(false)))
      .subscribe({
        next: (session) => {
          this.applySession(session, false);
          this.shopSetupStatusService.refresh();
          this.notificationService.success('Đã cập nhật danh sách địa chỉ.');
        }
      });
  }

  updateOperationalSettings(payload: any): void {
    this.submittingAuthState.set(true);
    this.authApiService
      .updateOperationalSettings(payload)
      .pipe(finalize(() => this.submittingAuthState.set(false)))
      .subscribe({
        next: (session) => {
          this.applySession(session, false);
          this.shopSetupStatusService.refresh();
          this.notificationService.success('Cập nhật cài đặt vận hành thành công.');
        }
      });
  }

  updateShopProfile(patch: Partial<AuthShop>): void {
    const current = this.shopState();

    if (!current) {
      return;
    }

    const updated = { ...current, ...patch };
    this.shopState.set(updated);
    this.persistCurrentSessionState();
  }

  updateOnboarding(patch: Partial<AuthOnboarding>): void {
    const updated = {
      completed: false,
      currentStep: 'SHOP_PROFILE',
      ...(this.onboardingState() ?? {}),
      ...patch
    };

    this.onboardingState.set(updated);
    this.persistCurrentSessionState();
  }

  private navigateAfterAuth(redirectTo?: string | null, queryParams?: Record<string, string>): void {
    if (this.needsPasswordChange()) {
      void this.router.navigate(['/change-password'], queryParams ? { queryParams } : undefined);
      return;
    }

    if (this.needsShopCreation()) {
      const stepRoute = this.getOnboardingRoute();
      void this.router.navigate([stepRoute], queryParams ? { queryParams } : undefined);
      return;
    }

    if (redirectTo && redirectTo.startsWith('/')) {
      void this.router.navigateByUrl(redirectTo);
      return;
    }

    void this.router.navigate(['/app'], queryParams ? { queryParams } : undefined);
  }

  private getOnboardingRoute(): string {
    const step = this.onboardingState()?.currentStep || 'SHOP_PROFILE';
    switch (step) {
      case 'BUSINESS_TYPE': return '/shop-setup/business-type';
      case 'CATEGORY': return '/shop-setup/category';
      default: return '/shop-setup/profile';
    }
  }

  private tryRefreshSession(): void {
    const refreshToken = this.authTokenService.getRefreshToken();

    if (!refreshToken) {
      this.clearSession(false);
      return;
    }

    this.authApiService.refresh(refreshToken).subscribe({
      next: (session) => this.applySession(session, false),
      error: () => this.clearSession(false)
    });
  }

  private applySession(session: AuthSession, notify = false): void {
    const resolvedSession: AuthSession = {
      ...session,
      onboarding: this.resolveOnboardingState(session.onboarding)
    };

    if (session.accessToken) {
      this.authTokenService.setTokens(session.accessToken, session.refreshToken);
    }

    this.userState.set(resolvedSession.user);
    this.shopState.set(resolvedSession.shop);
    this.onboardingState.set(resolvedSession.onboarding);
    this.persistSession(resolvedSession);

    this.permissionService.setAuthContext(resolvedSession.user);

    // Load staff permissions after session is established
    this.permissionService.loadMyPermissions();

    if (notify) {
      this.notificationService.success(`Xin chao ${session.user.fullName}.`);
    }
  }

  private resolveOnboardingState(nextOnboarding: AuthOnboarding | null): AuthOnboarding | null {
    const currentOnboarding = this.onboardingState() ?? this.restoreSession()?.onboarding ?? null;

    if (currentOnboarding?.completed && (!nextOnboarding || !nextOnboarding.completed)) {
      return currentOnboarding;
    }

    return nextOnboarding;
  }

  private persistCurrentSessionState(): void {
    const user = this.userState();

    if (!user) {
      return;
    }

    this.persistSession({
      accessToken: this.authTokenService.getAccessToken() ?? undefined,
      refreshToken: this.authTokenService.getRefreshToken() ?? undefined,
      user,
      shop: this.shopState(),
      onboarding: this.onboardingState()
    });
  }

  private clearSession(redirectToLogin: boolean): void {
    this.authTokenService.clearTokens();
    this.userState.set(null);
    this.shopState.set(null);
    this.onboardingState.set(null);
    this.shopSetupStatusService.clear();
    this.clearPersistedSession();
    this.permissionService.clear();

    if (redirectToLogin) {
      void this.router.navigate(['/login']);
    }
  }

  private persistSession(session: AuthSession): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }

      window.localStorage.setItem(STORAGE_KEYS.authSession, JSON.stringify(session));
    } catch {
      // Ignore persistence errors.
    }
  }

  private restoreSession(): AuthSession | null {
    try {
      if (typeof window === 'undefined') {
        return null;
      }

      const raw = window.localStorage.getItem(STORAGE_KEYS.authSession);

      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as AuthSession;

      if (!parsed?.user?.id) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  private clearPersistedSession(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }

      window.localStorage.removeItem(STORAGE_KEYS.authSession);
    } catch {
      // Ignore persistence errors.
    }
  }
}

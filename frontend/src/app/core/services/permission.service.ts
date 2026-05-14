import { computed, inject, Injectable, signal } from '@angular/core';
import { AppRole, AuthUser } from '../auth/auth.models';
import { PermissionApiService, PermissionItem } from './permission-api.service';

/** All permission codes matching the backend PermissionCode enum */
export type PermissionCode =
  | 'SHOP_SETTINGS'
  | 'STAFF_MANAGE'
  | 'STAFF_SCHEDULE_MANAGE'
  | 'STAFF_SCHEDULE_VIEW_OWN'
  | 'PRODUCT_VIEW'
  | 'PRODUCT_CREATE'
  | 'PRODUCT_EDIT'
  | 'PRODUCT_DELETE'
  | 'ORDER_VIEW'
  | 'ORDER_CREATE'
  | 'ORDER_UPDATE_STATUS'
  | 'REPORT_REVENUE';

@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly permissionApi = inject(PermissionApiService);

  private readonly permissionsState = signal<string[]>([]);
  private readonly loadedState = signal(false);
  private readonly currentRoleState = signal<AppRole | null>(null);
  private readonly currentUserIdState = signal<number | null>(null);

  readonly permissions = this.permissionsState.asReadonly();
  readonly loaded = this.loadedState.asReadonly();

  /** OWNER/ADMIN always returns true. STAFF checks granted permissions. */
  readonly isOwnerOrAdmin = computed(() => {
    const role = this.currentRoleState();
    return role === 'SHOP_OWNER';
  });

  setAuthContext(user: AuthUser | null): void {
    if (!user) {
      this.clear();
      return;
    }

    this.currentRoleState.set(user.role);
    this.currentUserIdState.set(Number(user.id));
    this.permissionsState.set([]);
    this.loadedState.set(false);
  }

  /**
   * Check if the current user has a specific permission.
   * OWNER always has all permissions. STAFF checks the loaded list.
   */
  hasPermission(code: PermissionCode): boolean {
    if (this.isOwnerOrAdmin()) return true;
    // STAFF_SCHEDULE_VIEW_OWN is always granted
    if (code === 'STAFF_SCHEDULE_VIEW_OWN') return true;
    return this.permissionsState().includes(code);
  }

  /**
   * Load permissions for current staff user from backend.
   * Called on app init for STAFF users.
   */
  loadMyPermissions(): void {
    const userId = this.currentUserIdState();
    if (!userId) return;

    // OWNER always has all permissions — no need to load
    if (this.currentRoleState() === 'SHOP_OWNER') {
      this.loadedState.set(true);
      return;
    }

    this.permissionApi.getStaffPermissions(userId).subscribe({
      next: (permissions) => {
        const codes = permissions
          .filter(p => p.granted)
          .map(p => p.code);
        this.permissionsState.set(codes);
        this.loadedState.set(true);
      },
      error: () => {
        // Fallback: assume minimal permissions
        this.permissionsState.set(['STAFF_SCHEDULE_VIEW_OWN']);
        this.loadedState.set(true);
      }
    });
  }

  /** Reset permissions state (on logout) */
  clear(): void {
    this.permissionsState.set([]);
    this.loadedState.set(false);
    this.currentRoleState.set(null);
    this.currentUserIdState.set(null);
  }
}

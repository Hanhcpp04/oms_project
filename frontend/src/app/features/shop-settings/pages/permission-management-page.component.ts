import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { map } from 'rxjs';
import { HttpService } from '../../../core/http/http.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionApiService, PermissionItem } from '../../../core/services/permission-api.service';
import { UiToggleComponent } from '../../../shared/components/ui/ui-toggle.component';

interface StaffMember {
  id: number;
  fullName: string;
  email: string;
  username: string;
  isActive: boolean;
}

interface PermissionCategory {
  name: string;
  label: string;
  permissions: PermissionItem[];
}

@Component({
  selector: 'app-permission-management-page',
  standalone: true,
  imports: [CommonModule, UiToggleComponent],
  template: `
    <div class="permission-page">
      <header class="page-header">
        <div class="header-copy">
          <p class="page-eyebrow">Shop settings</p>
          <h1 class="page-title">Phân quyền nhân viên</h1>
          <p class="page-subtitle">
            Chọn nhân viên ở cột trái để xem và chỉnh quyền theo từng nhóm.
          </p>
        </div>
      </header>

      <div class="page-body">
        <aside class="staff-panel">
          <div class="panel-head">
            <div>
              <h2 class="panel-title">Danh sách nhân viên</h2>
              <p class="panel-subtitle">Chọn một người để chỉnh quyền truy cập.</p>
            </div>
            <span class="panel-badge">{{ staffList().length }}</span>
          </div>

          @if (loadingStaff()) {
            <div class="panel-state">
              <div class="spinner"></div>
              <span>Đang tải danh sách nhân viên...</span>
            </div>
          } @else if (staffList().length === 0) {
            <div class="panel-empty">
              <div class="empty-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3>Chưa có nhân viên</h3>
              <p>Hệ thống chưa có dữ liệu nhân viên để phân quyền.</p>
            </div>
          } @else {
            <div class="staff-list">
              @for (staff of staffList(); track staff.id) {
                <button
                  type="button"
                  class="staff-item"
                  [class.active]="selectedStaffId() === staff.id"
                  (click)="selectStaff(staff)">
                  <div class="staff-avatar">{{ getInitials(staff.fullName) }}</div>
                  <div class="staff-info">
                    <div class="staff-main-row">
                      <span class="staff-name">{{ staff.fullName }}</span>
                      <span class="status-pill" [class.inactive]="!staff.isActive">
                        {{ staff.isActive ? 'Hoạt động' : 'Tạm dừng' }}
                      </span>
                    </div>
                    <span class="staff-email">{{ staff.email || staff.username }}</span>
                  </div>
                </button>
              }
            </div>
          }
        </aside>

        <section class="permissions-panel">
          @if (selectedStaff(); as staff) {
            <div class="panel-head detail-head">
              <div class="selected-summary">
                <div class="summary-avatar">{{ getInitials(staff.fullName) }}</div>
                <div class="summary-copy">
                  <h2 class="panel-title">Quyền của {{ staff.fullName }}</h2>
                  <p class="panel-subtitle">
                    {{ staff.email || staff.username }} ·
                    {{ countGrantedPermissions() }} quyền đang bật
                  </p>
                </div>
              </div>

              @if (saving()) {
                <div class="sync-chip" aria-live="polite">
                  <div class="spinner small"></div>
                  <span>Đang cập nhật...</span>
                </div>
              }
            </div>

            <div class="permissions-content">
              @if (loadingPermissions()) {
                <div class="panel-state large">
                  <div class="spinner"></div>
                  <span>Đang tải quyền của nhân viên...</span>
                </div>
              } @else {
                <div class="permission-groups">
                  @for (category of permissionCategories(); track category.name) {
                    <section class="permission-group">
                      <button
                        type="button"
                        class="category-head"
                        [attr.aria-expanded]="!isCategoryCollapsed(category.name)"
                        (click)="toggleCategoryCollapse(category.name)">
                        <div>
                          <h3 class="category-title">{{ category.label }}</h3>
                          <p class="category-caption">{{ category.permissions.length }} quyền</p>
                        </div>
                        <span class="category-toggle">
                          {{ isCategoryCollapsed(category.name) ? 'Mở rộng' : 'Thu gọn' }}
                        </span>
                      </button>

                      @if (!isCategoryCollapsed(category.name)) {
                        <div class="permission-list">
                          @for (perm of category.permissions; track perm.code) {
                            <div class="permission-row" [class.locked]="perm.code === alwaysGrantedPermission">
                              <div class="permission-copy">
                                <div class="permission-topline">
                                  <span class="permission-name">{{ perm.name }}</span>
                                  @if (perm.code === alwaysGrantedPermission) {
                                    <span class="permission-flag">Mặc định</span>
                                  }
                                </div>
                                <p class="permission-description">
                                  {{ perm.description || 'Không có mô tả cho quyền này.' }}
                                </p>
                              </div>

                              <app-ui-toggle
                                [checked]="isPermissionGranted(perm.code)"
                                [disabled]="saving() || perm.code === alwaysGrantedPermission"
                                [ariaLabel]="'Cập nhật quyền ' + perm.name"
                                (toggled)="togglePermission(perm.code, $event)" />
                            </div>
                          }
                        </div>
                      }
                    </section>
                  }
                </div>
              }
            </div>
          } @else {
            <div class="panel-empty detail-empty">
              <div class="empty-icon shield">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                </svg>
              </div>
              <h3>Chọn nhân viên để bắt đầu</h3>
              <p>Danh sách quyền sẽ hiển thị ở đây sau khi bạn chọn một nhân viên ở cột bên trái.</p>
            </div>
          }
        </section>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .permission-page {
      display: grid;
      gap: 20px;
    }

    .page-header {
      display: flex;
      align-items: flex-start;
      gap: 16px;
    }

    .header-copy {
      max-width: 720px;
    }

    .page-eyebrow {
      margin: 0 0 6px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: uppercase;
      color: var(--color-text-tertiary);
    }

    .page-title {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      color: var(--color-text-primary);
    }

    .page-subtitle {
      margin: 8px 0 0;
      font-size: 14px;
      line-height: 1.6;
      color: var(--color-text-secondary);
    }

    .page-body {
      display: grid;
      grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);
      gap: 20px;
      align-items: start;
    }

    .staff-panel,
    .permissions-panel {
      min-width: 0;
      border: 1px solid var(--color-border);
      border-radius: 8px;
      background: var(--color-surface);
      overflow: hidden;
    }

    .staff-panel {
      position: sticky;
      top: 16px;
    }

    .permissions-panel {
      display: flex;
      flex-direction: column;
      min-height: 0;
      height: min(760px, calc(100vh - 180px));
    }

    .permissions-content {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
    }

    .panel-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 20px;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface);
    }

    .detail-head {
      align-items: center;
    }

    .panel-title {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: var(--color-text-primary);
    }

    .panel-subtitle {
      margin: 4px 0 0;
      font-size: 12px;
      line-height: 1.5;
      color: var(--color-text-secondary);
    }

    .panel-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 28px;
      height: 28px;
      padding: 0 10px;
      border-radius: 999px;
      background: var(--color-surface-secondary);
      color: var(--color-text-secondary);
      font-size: 12px;
      font-weight: 700;
    }

    .staff-list {
      display: grid;
      gap: 8px;
      padding: 10px;
    }

    .staff-item {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr);
      gap: 12px;
      align-items: center;
      width: 100%;
      padding: 12px;
      border: 1px solid transparent;
      border-radius: 8px;
      background: transparent;
      text-align: left;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .staff-item:hover {
      background: var(--color-surface-secondary);
      border-color: var(--color-border);
    }

    .staff-item.active {
      border-color: rgba(39, 93, 197, 0.24);
      background: rgba(39, 93, 197, 0.08);
      box-shadow: inset 0 0 0 1px rgba(39, 93, 197, 0.08);
    }

    .staff-avatar,
    .summary-avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      background: #111827;
      color: #fff;
      font-weight: 700;
      flex-shrink: 0;
    }

    .staff-avatar {
      width: 40px;
      height: 40px;
      font-size: 13px;
    }

    .summary-avatar {
      width: 48px;
      height: 48px;
      font-size: 14px;
    }

    .staff-info,
    .summary-copy {
      min-width: 0;
    }

    .staff-main-row {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .staff-name {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
      font-weight: 600;
      color: var(--color-text-primary);
    }

    .staff-email {
      display: block;
      margin-top: 3px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 12px;
      color: var(--color-text-tertiary);
    }

    .status-pill,
    .permission-flag,
    .sync-chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }

    .status-pill {
      padding: 4px 8px;
      background: rgba(22, 163, 74, 0.1);
      color: #15803d;
    }

    .status-pill.inactive {
      background: rgba(148, 163, 184, 0.18);
      color: #475569;
    }

    .selected-summary {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .sync-chip {
      gap: 8px;
      padding: 8px 12px;
      background: rgba(39, 93, 197, 0.08);
      color: #275dc5;
    }

    .permission-groups {
      display: grid;
      gap: 16px;
      padding: 20px;
    }

    .permission-group {
      border: 1px solid var(--color-border);
      border-radius: 8px;
      overflow: hidden;
      background: var(--color-surface);
    }

    .category-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      padding: 14px 16px;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-surface-secondary);
      border-left: none;
      border-right: none;
      border-top: none;
      text-align: left;
      cursor: pointer;
    }

    .category-head:hover {
      background: rgba(15, 23, 42, 0.04);
    }

    .category-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 78px;
      padding-left: 16px;
      font-size: 12px;
      font-weight: 600;
      color: var(--color-text-secondary);
      white-space: nowrap;
    }

    .category-title {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: var(--color-text-primary);
    }

    .category-caption {
      margin: 2px 0 0;
      font-size: 12px;
      color: var(--color-text-tertiary);
    }

    .permission-list {
      display: grid;
    }

    .permission-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 16px;
      align-items: center;
      padding: 16px;
      border-top: 1px solid var(--color-border);
    }

    .permission-row:first-child {
      border-top: none;
    }

    .permission-row.locked {
      background: rgba(15, 23, 42, 0.02);
    }

    .permission-copy {
      min-width: 0;
    }

    .permission-topline {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .permission-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--color-text-primary);
    }

    .permission-description {
      margin: 6px 0 0;
      font-size: 12px;
      line-height: 1.6;
      color: var(--color-text-secondary);
    }

    .permission-flag {
      padding: 3px 8px;
      background: rgba(22, 163, 74, 0.1);
      color: #15803d;
    }

    .panel-state,
    .panel-empty {
      display: grid;
      justify-items: center;
      gap: 12px;
      padding: 40px 24px;
      text-align: center;
      color: var(--color-text-secondary);
    }

    .panel-state.large,
    .detail-empty {
      min-height: 420px;
      align-content: center;
    }

    .panel-empty h3 {
      margin: 0;
      font-size: 16px;
      color: var(--color-text-primary);
    }

    .panel-empty p {
      max-width: 420px;
      margin: 0;
      font-size: 13px;
      line-height: 1.6;
      color: var(--color-text-secondary);
    }

    .empty-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 999px;
      border: 1px solid var(--color-border);
      background: var(--color-surface-secondary);
      color: var(--color-text-tertiary);
    }

    .empty-icon.shield {
      width: 64px;
      height: 64px;
    }

    .empty-icon svg {
      width: 26px;
      height: 26px;
      stroke: currentColor;
      fill: none;
      stroke-width: 1.75;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid rgba(15, 23, 42, 0.12);
      border-top-color: #111827;
      border-radius: 999px;
      animation: spin 0.8s linear infinite;
    }

    .spinner.small {
      width: 14px;
      height: 14px;
      border-width: 2px;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (max-width: 1024px) {
      .page-body {
        grid-template-columns: 1fr;
      }

      .staff-panel {
        position: static;
      }

      .permissions-panel {
        height: auto;
      }

      .permissions-content {
        overflow: visible;
      }
    }

    @media (max-width: 640px) {
      .panel-head,
      .detail-head,
      .staff-main-row,
      .permission-row {
        grid-template-columns: none;
      }

      .panel-head,
      .detail-head {
        flex-direction: column;
        align-items: stretch;
      }

      .selected-summary {
        align-items: flex-start;
      }

      .staff-main-row {
        flex-wrap: wrap;
      }

      .permission-row {
        grid-template-columns: 1fr;
        justify-items: start;
      }

      .category-head {
        align-items: flex-start;
        gap: 10px;
        flex-direction: column;
      }

      .category-toggle {
        min-width: 0;
        padding-left: 0;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PermissionManagementPageComponent implements OnInit {
  protected readonly alwaysGrantedPermission = 'STAFF_SCHEDULE_VIEW_OWN';

  private readonly permissionApi = inject(PermissionApiService);
  private readonly httpService = inject(HttpService);
  private readonly notificationService = inject(NotificationService);

  protected readonly staffList = signal<StaffMember[]>([]);
  protected readonly loadingStaff = signal(false);
  protected readonly selectedStaffId = signal<number | null>(null);
  protected readonly selectedStaff = signal<StaffMember | null>(null);
  protected readonly staffPermissions = signal<PermissionItem[]>([]);
  protected readonly grantedCodes = signal<Set<string>>(new Set());
  protected readonly collapsedCategories = signal<Set<string>>(new Set());
  protected readonly loadingPermissions = signal(false);
  protected readonly saving = signal(false);

  protected readonly countGrantedPermissions = computed(() => {
    const hasDefaultPermission = this.staffPermissions().some(
      (permission) => permission.code === this.alwaysGrantedPermission
    );

    return this.grantedCodes().size + (hasDefaultPermission ? 1 : 0);
  });
  protected readonly permissionCategories = computed<PermissionCategory[]>(() => {
    const categoryMap = new Map<string, PermissionItem[]>();

    for (const permission of this.staffPermissions()) {
      const currentCategory = categoryMap.get(permission.category) ?? [];
      currentCategory.push(permission);
      categoryMap.set(permission.category, currentCategory);
    }

    const categoryMeta: Record<string, { label: string; order: number }> = {
      SHOP: {
        label: 'Quản lý shop',
        order: 1
      },
      STAFF: {
        label: 'Nhân sự',
        order: 2
      },
      PRODUCT: {
        label: 'Sản phẩm',
        order: 3
      },
      ORDER: {
        label: 'Đơn hàng',
        order: 4
      },
      REPORT: {
        label: 'Báo cáo',
        order: 5
      }
    };

    return Array.from(categoryMap.entries())
      .map(([name, permissions]) => ({
        name,
        label: categoryMeta[name]?.label ?? name,
        permissions: [...permissions].sort((left, right) => left.name.localeCompare(right.name, 'vi')),
        order: categoryMeta[name]?.order ?? 99
      }))
      .sort((left, right) => left.order - right.order)
      .map(({ order: _order, ...category }) => category);
  });

  ngOnInit(): void {
    this.loadStaff();
  }

  protected selectStaff(staff: StaffMember): void {
    if (this.selectedStaffId() === staff.id) {
      return;
    }

    this.selectedStaffId.set(staff.id);
    this.selectedStaff.set(staff);
    this.grantedCodes.set(new Set());
    this.loadStaffPermissions(staff.id);
  }

  protected isPermissionGranted(code: string): boolean {
    if (code === this.alwaysGrantedPermission) {
      return true;
    }

    return this.grantedCodes().has(code);
  }

  protected isCategoryCollapsed(categoryName: string): boolean {
    return this.collapsedCategories().has(categoryName);
  }

  protected toggleCategoryCollapse(categoryName: string): void {
    this.collapsedCategories.update((current) => {
      const next = new Set(current);

      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }

      return next;
    });
  }

  protected togglePermission(code: string, checked: boolean): void {
    if (code === this.alwaysGrantedPermission || this.saving()) {
      return;
    }

    const staffId = this.selectedStaffId();
    if (!staffId) {
      return;
    }

    const previous = new Set(this.grantedCodes());
    const next = new Set(previous);

    if (checked) {
      next.add(code);
    } else {
      next.delete(code);
    }

    this.grantedCodes.set(next);
    this.saving.set(true);

    this.permissionApi.updateStaffPermissions(staffId, Array.from(next)).subscribe({
      next: () => {
        if (this.selectedStaffId() === staffId) {
          this.saving.set(false);
          this.syncPermissionState(next);
        }

        const actionText = checked ? 'bật' : 'tắt';
        this.notificationService.success(`Đã ${actionText} quyền thành công.`);
      },
      error: () => {
        if (this.selectedStaffId() === staffId) {
          this.grantedCodes.set(previous);
          this.saving.set(false);
        }
      }
    });
  }

  protected getInitials(fullName: string): string {
    const normalized = fullName.trim().split(/\s+/).filter(Boolean);
    if (normalized.length === 0) {
      return 'NV';
    }

    if (normalized.length === 1) {
      return normalized[0].slice(0, 2).toUpperCase();
    }

    return `${normalized[0][0]}${normalized[normalized.length - 1][0]}`.toUpperCase();
  }

  private loadStaff(): void {
    this.loadingStaff.set(true);

    this.httpService
      .get<{ data?: { content?: StaffMember[] } }>('/staff')
      .pipe(map((response) => response.data?.content ?? []))
      .subscribe({
        next: (staff) => {
          this.staffList.set(staff);
          this.loadingStaff.set(false);

          if (staff.length > 0) {
            this.selectStaff(staff[0]);
          }
        },
        error: () => {
          this.loadingStaff.set(false);
        }
      });
  }

  private loadStaffPermissions(staffId: number): void {
    this.loadingPermissions.set(true);
    this.saving.set(false);

    this.permissionApi.getStaffPermissions(staffId).subscribe({
      next: (permissions) => {
        if (this.selectedStaffId() !== staffId) {
          return;
        }

        this.staffPermissions.set(permissions);
        this.collapsedCategories.update((current) => {
          const availableCategories = new Set(permissions.map((permission) => permission.category));
          return new Set([...current].filter((name) => availableCategories.has(name)));
        });
        this.grantedCodes.set(
          new Set(
            permissions
              .filter((permission) => permission.granted && permission.code !== this.alwaysGrantedPermission)
              .map((permission) => permission.code)
          )
        );
        this.loadingPermissions.set(false);
      },
      error: () => {
        if (this.selectedStaffId() !== staffId) {
          return;
        }

        this.loadingPermissions.set(false);
      }
    });
  }

  private syncPermissionState(grantedCodes: Set<string>): void {
    this.grantedCodes.set(new Set(grantedCodes));
    this.staffPermissions.update((permissions) =>
      permissions.map((permission) => ({
        ...permission,
        granted: permission.code === this.alwaysGrantedPermission ? true : grantedCodes.has(permission.code)
      }))
    );
  }
}

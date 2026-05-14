import { ChangeDetectionStrategy, Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PermissionCode, PermissionService } from '../../../core/services/permission.service';
import { NotificationService } from '../../../core/services/notification.service';

/**
 * A button wrapper that shows a lock overlay when the user lacks a required permission.
 *
 * Usage:
 * ```html
 * <app-permission-button [permission]="'PRODUCT_CREATE'" (allowed)="onCreate()">
 *   <app-ui-button variant="primary">Tạo sản phẩm</app-ui-button>
 * </app-permission-button>
 * ```
 *
 * If user has permission → click fires (allowed) event.
 * If user lacks permission → shows lock icon + "Xin quyền" tooltip.
 */
@Component({
  selector: 'app-permission-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="permission-btn-wrapper" [class.locked]="!hasAccess">
      <!-- Clickable area -->
      <div (click)="onClick($event)" [class.pointer-events-none]="!hasAccess" [class.opacity-40]="!hasAccess">
        <ng-content></ng-content>
      </div>

      <!-- Lock overlay for unauthorized users -->
      @if (!hasAccess) {
        <div class="lock-overlay" (click)="onRequestPermission($event)">
          <div class="lock-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span class="lock-text">Không có quyền</span>
          </div>
          <div class="request-tooltip">Nhấn để xin quyền từ chủ shop</div>
        </div>
      }
    </div>
  `,
  styles: [`
    .permission-btn-wrapper {
      position: relative;
      display: inline-flex;
    }

    .permission-btn-wrapper.locked {
      cursor: not-allowed;
    }

    .lock-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 10;
    }

    .lock-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: 20px;
      background: rgba(211, 0, 5, 0.9);
      color: white;
      font-size: 11px;
      font-weight: 600;
      backdrop-filter: blur(4px);
      box-shadow: 0 2px 8px rgba(211, 0, 5, 0.3);
      transition: all 0.2s ease;
    }

    .lock-text {
      white-space: nowrap;
    }

    .request-tooltip {
      position: absolute;
      top: calc(100% + 6px);
      left: 50%;
      transform: translateX(-50%);
      padding: 4px 10px;
      border-radius: 6px;
      background: #111;
      color: white;
      font-size: 11px;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s ease;
      z-index: 20;
    }

    .lock-overlay:hover .request-tooltip {
      opacity: 1;
    }

    .lock-overlay:hover .lock-badge {
      background: rgba(211, 0, 5, 1);
      transform: scale(1.05);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PermissionButtonComponent {
  private readonly permissionService = inject(PermissionService);
  private readonly notificationService = inject(NotificationService);

  @Input({ required: true }) permission!: PermissionCode;
  @Output() allowed = new EventEmitter<void>();

  get hasAccess(): boolean {
    return this.permissionService.hasPermission(this.permission);
  }

  onClick(event: MouseEvent): void {
    event.stopPropagation();
    if (this.hasAccess) {
      this.allowed.emit();
    }
  }

  onRequestPermission(event: MouseEvent): void {
    event.stopPropagation();
    this.notificationService.info(
      `Bạn không có quyền "${this.getPermissionName()}". Vui lòng liên hệ chủ shop để được cấp quyền.`,
      6000
    );
  }

  private getPermissionName(): string {
    const names: Record<string, string> = {
      SHOP_SETTINGS: 'Quản lý cài đặt shop',
      STAFF_MANAGE: 'Tạo/xóa nhân viên',
      STAFF_SCHEDULE_MANAGE: 'Quản lý ca làm việc',
      STAFF_SCHEDULE_VIEW_OWN: 'Xem lịch làm của mình',
      PRODUCT_VIEW: 'Xem sản phẩm',
      PRODUCT_CREATE: 'Tạo sản phẩm',
      PRODUCT_EDIT: 'Sửa sản phẩm',
      PRODUCT_DELETE: 'Xóa sản phẩm',
      ORDER_VIEW: 'Xem đơn hàng',
      ORDER_CREATE: 'Tạo đơn hàng',
      ORDER_UPDATE_STATUS: 'Cập nhật trạng thái đơn',
      REPORT_REVENUE: 'Xem báo cáo doanh thu'
    };
    return names[this.permission] ?? this.permission;
  }
}

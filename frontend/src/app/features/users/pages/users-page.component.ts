import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { PageTitleComponent } from '../../../shared/components/ui/page-title.component';
import { UiBadgeComponent } from '../../../shared/components/ui/ui-badge.component';
import { UiButtonComponent } from '../../../shared/components/ui/ui-button.component';
import { UiCardComponent } from '../../../shared/components/ui/ui-card.component';
import { UiInputComponent } from '../../../shared/components/ui/ui-input.component';
import { UiStatCardComponent } from '../../../shared/components/ui/ui-stat-card.component';
import { UserAccount } from '../data-access/models/user-account.model';
import { UserListComponent } from '../components/user-list.component';
import { UsersStore } from '../state/users.store';
import { HasRoleDirective } from '../../../shared/directives/has-role.directive';
import { ShiftCalendarComponent } from '../components/shift-calendar.component';
import { ShiftFormModalComponent } from '../components/shift-form-modal.component';
import { ShiftApiService } from '../data-access/shift-api.service';
import { WorkShiftResponse } from '../data-access/models/shift.model';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [
    CommonModule,
    PageTitleComponent,
    UiInputComponent,
    UiButtonComponent,
    UiCardComponent,
    UiStatCardComponent,
    UiBadgeComponent,
    UserListComponent,
    HasRoleDirective,
    ShiftCalendarComponent,
    ShiftFormModalComponent
  ],
  templateUrl: './users-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsersPageComponent implements OnInit {
  readonly store = inject(UsersStore);
  private readonly shiftApiService = inject(ShiftApiService);
  private readonly notificationService = inject(NotificationService);

  activeTab: 'list' | 'schedule' = 'list';
  searchTerm = '';

  shifts: WorkShiftResponse[] = [];
  loadingShifts = false;

  showShiftModal = false;
  editingShift: WorkShiftResponse | null = null;
  shiftModalDate = '';

  ngOnInit(): void {
    this.store.loadUsers();
    this.loadShifts();
  }

  setTab(tab: 'list' | 'schedule'): void {
    this.activeTab = tab;
    if (tab === 'schedule') {
      this.loadShifts();
    }
  }

  loadShifts(): void {
    this.loadingShifts = true;
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split('T')[0];

    this.shiftApiService.getShiftsByDateRange(firstDay, lastDay).subscribe({
      next: (data) => {
        this.shifts = data;
        this.loadingShifts = false;
      },
      error: () => {
        this.notificationService.error('Không thể tải lịch làm việc');
        this.loadingShifts = false;
      }
    });
  }

  openCreateShiftModal(date: string = ''): void {
    this.editingShift = null;
    this.shiftModalDate = date;
    this.showShiftModal = true;
  }

  openEditShiftModal(shift: WorkShiftResponse): void {
    this.editingShift = shift;
    this.shiftModalDate = shift.shiftDate;
    this.showShiftModal = true;
  }

  closeShiftModal(): void {
    this.showShiftModal = false;
    this.editingShift = null;
  }

  saveShift(payload: any): void {
    const ob$ = this.editingShift
      ? this.shiftApiService.updateShift(this.editingShift.id, payload)
      : this.shiftApiService.createShift(payload);

    ob$.subscribe({
      next: () => {
        this.notificationService.success(this.editingShift ? 'Cập nhật ca thành công' : 'Tạo ca thành công');
        this.closeShiftModal();
        this.loadShifts();
      },
      error: (err) => {
        this.notificationService.error(err.error?.message || 'Lỗi lưu ca làm việc');
      }
    });
  }

  deleteShift(shift: WorkShiftResponse): void {
    if (!confirm(`Bạn có chắc muốn xóa ca làm việc ngày ${shift.shiftDate} không?`)) return;

    this.shiftApiService.deleteShift(shift.id).subscribe({
      next: () => {
        this.notificationService.success('Đã xóa ca làm việc');
        this.loadShifts();
      },
      error: (err) => {
        this.notificationService.error(err.error?.message || 'Lỗi xóa ca làm việc');
      }
    });
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
  }

  applySearch(): void {
    this.store.loadUsers({ page: 0, size: 20, search: this.searchTerm || undefined });
  }

  resetSearch(): void {
    this.searchTerm = '';
    this.store.loadUsers({ page: 0, size: 20, search: undefined });
  }

  autoGenerateEmployeeAccount(): void {
    const fullName = window.prompt('Nhập họ tên nhân viên để tạo tài khoản nhanh:');
    if (fullName && fullName.trim()) {
      this.searchTerm = '';
      this.store.autoGenerateEmployeeAccount(fullName.trim());
    }
  }

  dismissGeneratedCredential(): void {
    this.store.clearGeneratedCredential();
  }

  selectUser(user: UserAccount): void {
    this.store.selectUser(user);
  }

  copyPasswordToClipboard(password: string): void {
    if (!password) return;

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(password).then(() => {
        this.notificationService.success('Đã sao chép mật khẩu');
      }).catch(() => this.fallbackCopy(password));
    } else {
      this.fallbackCopy(password);
    }
  }

  private fallbackCopy(text: string): void {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (successful) {
        this.notificationService.success('Đã sao chép mật khẩu');
      }
    } catch (err) {
      this.notificationService.error('Không thể sao chép mật khẩu');
    }
  }

  protected getStatusVariant(status: string): 'primary' | 'warning' | 'info' | 'success' | 'danger' {
    switch (status) {
      case 'NEW': return 'primary';
      case 'PROCESSING': return 'warning';
      case 'SHIPPED': return 'info';
      case 'COMPLETED': return 'success';
      case 'CANCELLED': return 'danger';
      default: return 'primary';
    }
  }

  protected getStatusLabel(status: string): string {
    switch (status) {
      case 'NEW': return 'Mới';
      case 'PROCESSING': return 'Đang xử lý';
      case 'SHIPPED': return 'Đang giao';
      case 'COMPLETED': return 'Hoàn thành';
      case 'CANCELLED': return 'Đã hủy';
      default: return status;
    }
  }

  protected getUserRoleLabel(role: UserAccount['role']): string {
    switch (role) {
      case 'OWNER':
        return 'Chủ shop';
      case 'ADMIN':
        return 'Quản trị';
      case 'OPERATOR':
        return 'Điều phối';
      case 'VIEWER':
        return 'Chỉ xem';
      case 'STAFF':
      default:
        return 'Nhân viên';
    }
  }
}

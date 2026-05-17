import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AppNotification, AppNotificationService } from '../../../core/services/app-notification.service';

@Component({
  selector: 'app-oms-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent {
  protected readonly notifications = inject(AppNotificationService);
  private readonly router = inject(Router);

  @Input() sidebarCollapsed = false;
  @Input() currentUserName = 'OMS Operator';
  @Input() currentShopName = 'OMS Shop';

  @Output() toggleSidebar = new EventEmitter<void>();
  @Output() toggleMobileSidebar = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  protected readonly notificationPanelOpen = signal(false);

  protected toggleNotifications(): void {
    this.notificationPanelOpen.update((open) => !open);
  }

  protected markAllRead(event: Event): void {
    event.stopPropagation();
    this.notifications.markAllRead();
  }

  protected openNotification(notification: AppNotification): void {
    this.notifications.markRead(notification);
    this.notificationPanelOpen.set(false);

    if (notification.linkUrl) {
      void this.router.navigateByUrl(notification.linkUrl);
    }
  }

  protected notificationTrackBy(_: number, notification: AppNotification): number {
    return notification.id;
  }

  protected formatNotificationTime(value?: string): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const diffMs = Date.now() - date.getTime();
    const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

    if (diffMinutes < 1) {
      return 'Vua xong';
    }

    if (diffMinutes < 60) {
      return `${diffMinutes} phut truoc`;
    }

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours} gio truoc`;
    }

    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  protected severityDotClass(severity: AppNotification['severity']): string {
    switch (severity) {
      case 'SUCCESS':
        return 'bg-[var(--color-success)]';
      case 'WARNING':
        return 'bg-[var(--color-warning)]';
      case 'ERROR':
        return 'bg-[var(--color-danger)]';
      default:
        return 'bg-[var(--color-info)]';
    }
  }
}

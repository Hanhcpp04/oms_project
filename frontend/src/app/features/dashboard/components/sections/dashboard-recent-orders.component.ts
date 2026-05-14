import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardStore } from '../../state/dashboard.store';
import { UiBadgeComponent } from '../../../../shared/components/ui/ui-badge.component';

@Component({
  selector: 'app-dashboard-recent-orders',
  standalone: true,
  imports: [CommonModule, UiBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-2xl border border-[var(--color-border)] bg-white">
      <div class="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
        <h3 class="m-0 text-sm font-bold text-[var(--color-text-primary)]">Đơn hàng gần đây</h3>
        <span class="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]">Mới nhất</span>
      </div>
      <div class="divide-y divide-[var(--color-border)]">
        @for (order of store.recentOrders(); track order.id) {
          <div class="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-[var(--color-bg)]">
            <div class="flex min-w-0 items-center gap-3">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-bg)] text-[10px] font-black text-[var(--color-text-primary)]">
                {{ order.orderType === 'RENT' ? '🔄' : '📦' }}
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="truncate text-sm font-bold text-[var(--color-text-primary)]">{{ order.orderNumber }}</span>
                  <span class="shrink-0 rounded bg-[var(--color-bg)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--color-text-tertiary)]">
                    {{ order.orderType === 'RENT' ? 'Thuê' : 'Bán' }}
                  </span>
                  @if (order.sourceMethod === 'AI_PARSE') {
                    <span class="shrink-0 text-[9px]">🤖</span>
                  } @else if (order.sourceMethod === 'PUBLIC_FORM') {
                    <span class="shrink-0 text-[9px]">📝</span>
                  }
                </div>
                <p class="m-0 truncate text-[11px] text-[var(--color-text-tertiary)]">{{ order.customerName }} · {{ order.createdAt }}</p>
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-3">
              <app-ui-badge [variant]="getStatusVariant(order.status)">{{ getStatusLabel(order.status) }}</app-ui-badge>
              <span class="min-w-[72px] text-right text-sm font-bold text-[var(--color-text-primary)]">{{ formatCurrency(order.total) }}</span>
            </div>
          </div>
        } @empty {
          <div class="px-5 py-10 text-center text-xs text-[var(--color-text-tertiary)]">Chưa có đơn hàng nào.</div>
        }
      </div>
    </div>
  `
})
export class DashboardRecentOrdersComponent {
  readonly store = inject(DashboardStore);

  getStatusVariant(s: string): 'info' | 'warning' | 'primary' | 'success' | 'danger' | 'default' {
    const map: Record<string, 'info' | 'warning' | 'primary' | 'success' | 'danger' | 'default'> = {
      PENDING: 'default', NEW: 'info', CONFIRMED: 'primary', PACKING: 'warning',
      SHIPPED: 'info', DONE: 'success', CANCELLED: 'danger', DEPOSITED: 'warning',
      PAID: 'success', RENTING: 'info', OVERDUE: 'danger', RETURNED: 'default'
    };
    return map[s] || 'default';
  }

  getStatusLabel(s: string): string {
    const map: Record<string, string> = {
      PENDING: 'Chờ', NEW: 'Mới', CONFIRMED: 'Xác nhận', PACKING: 'Đóng gói',
      SHIPPED: 'Đang giao', DONE: 'Xong', CANCELLED: 'Hủy', DEPOSITED: 'Đã cọc',
      PAID: 'Đã TT', RENTING: 'Đang thuê', OVERDUE: 'Quá hạn', RETURNED: 'Đã trả'
    };
    return map[s] || s;
  }

  formatCurrency(v: number): string {
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'tr';
    return (v / 1_000).toFixed(0) + 'k';
  }
}

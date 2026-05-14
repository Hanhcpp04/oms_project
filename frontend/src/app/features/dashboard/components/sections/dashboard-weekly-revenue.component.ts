import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardStore } from '../../state/dashboard.store';

@Component({
  selector: 'app-dashboard-weekly-revenue',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-2xl border border-[var(--color-border)] bg-white">
      <div class="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
        <div>
          <h3 class="m-0 text-sm font-bold text-[var(--color-text-primary)]">Doanh thu tuần</h3>
          <p class="m-0 mt-0.5 text-xs text-[var(--color-text-tertiary)]">{{ store.totalWeekOrders() }} đơn hàng</p>
        </div>
        <span class="text-sm font-black text-[var(--color-text-primary)]">{{ formatCurrency(store.totalRevenue()) }}</span>
      </div>
      <div class="p-4 space-y-3">
        @for (day of store.revenue(); track day.label) {
          <div>
            <div class="mb-1 flex items-center justify-between text-xs">
              <span class="font-semibold text-[var(--color-text-secondary)]">{{ day.label }}</span>
              <div class="flex items-center gap-3">
                <span class="text-[var(--color-text-tertiary)]">{{ day.orders }} đơn</span>
                <span class="min-w-[72px] text-right font-bold text-[var(--color-text-primary)]">{{ formatCurrency(day.revenue) }}</span>
              </div>
            </div>
            <div class="h-2 w-full overflow-hidden rounded-full bg-[var(--color-bg)]">
              <div class="h-full rounded-full bg-[var(--color-text-primary)] transition-all duration-500" [style.width.%]="getBarPct(day.revenue)"></div>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class DashboardWeeklyRevenueComponent {
  readonly store = inject(DashboardStore);

  getBarPct(rev: number): number {
    const max = Math.max(...this.store.revenue().map(r => r.revenue));
    return max > 0 ? (rev / max) * 100 : 0;
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(v);
  }
}

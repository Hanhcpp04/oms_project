import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardStore } from '../../state/dashboard.store';

@Component({
  selector: 'app-dashboard-staff-section',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-2xl border border-[var(--color-border)] bg-white">
      <div class="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
        <h3 class="m-0 text-sm font-bold text-[var(--color-text-primary)]">Xếp hạng nhân viên</h3>
        <span class="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]">Theo doanh thu</span>
      </div>
      <div class="p-4 space-y-3">
        @for (emp of store.employeeStats(); track emp.id; let i = $index) {
          <div class="rounded-xl border border-[var(--color-border)] p-3 transition-colors hover:border-[var(--color-border-hover)]">
            <div class="mb-2 flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <div class="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-black text-white"
                  [style.background-color]="colors[i % colors.length]">
                  {{ emp.avatarInitials }}
                </div>
                <div>
                  <p class="m-0 text-xs font-bold text-[var(--color-text-primary)]">{{ emp.name }}</p>
                  <p class="m-0 text-[10px] text-[var(--color-text-tertiary)]">{{ emp.ordersHandled }} đơn đã xử lý</p>
                </div>
              </div>
              <span class="text-sm font-black text-[var(--color-text-primary)]">{{ formatCurrency(emp.revenue) }}</span>
            </div>
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg)]">
              <div class="h-full rounded-full transition-all duration-700"
                [style.width.%]="(emp.revenue / maxRevenue) * 100"
                [style.background-color]="colors[i % colors.length]"></div>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class DashboardStaffSectionComponent {
  readonly store = inject(DashboardStore);
  readonly colors = ['#111111', '#3b82f6', '#8b5cf6', '#059669', '#d97706'];

  get maxRevenue() { return Math.max(...this.store.employeeStats().map(e => e.revenue), 1); }

  formatCurrency(v: number): string {
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + ' tr';
    return v.toLocaleString('vi-VN') + 'đ';
  }
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardStore } from '../../state/dashboard.store';

@Component({
  selector: 'app-dashboard-order-status',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-2xl border border-[var(--color-border)] bg-white">
      <div class="border-b border-[var(--color-border)] px-5 py-4">
        <h3 class="m-0 text-sm font-bold text-[var(--color-text-primary)]">Trạng thái đơn hàng</h3>
        <p class="m-0 mt-0.5 text-xs text-[var(--color-text-tertiary)]">Phân bổ theo trạng thái hiện tại</p>
      </div>
      <div class="p-5">
        <div class="flex flex-col items-center gap-5 sm:flex-row">
          <!-- Donut -->
          <div class="relative flex h-[160px] w-[160px] shrink-0 items-center justify-center">
            <svg viewBox="0 0 42 42" class="h-full w-full -rotate-90">
              <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#f3f4f6" stroke-width="3.5"/>
              @for (seg of segments; track seg.label) {
                <circle cx="21" cy="21" r="15.915" fill="transparent" [attr.stroke]="seg.color" stroke-width="4"
                  [attr.stroke-dasharray]="seg.dasharray" [attr.stroke-dashoffset]="seg.dashoffset"
                  class="transition-all duration-500"/>
              }
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span class="text-2xl font-black text-[var(--color-text-primary)]">{{ total }}</span>
              <span class="text-[9px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]">Tổng đơn</span>
            </div>
          </div>
          <!-- Legend -->
          <div class="flex-1 space-y-1">
            @for (g of store.orderStatusGroups(); track g.status) {
              <div class="flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-colors hover:bg-[var(--color-bg)]">
                <div class="flex items-center gap-2">
                  <span class="h-2.5 w-2.5 rounded-full" [style.background-color]="g.color"></span>
                  <span class="text-xs text-[var(--color-text-secondary)]">{{ g.label }}</span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="text-xs font-bold text-[var(--color-text-primary)]">{{ g.count }}</span>
                  <span class="w-10 text-right text-[10px] text-[var(--color-text-tertiary)]">{{ g.percentage }}%</span>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `
})
export class DashboardOrderStatusComponent {
  readonly store = inject(DashboardStore);

  get total() { return this.store.orderStatusGroups().reduce((s, g) => s + g.count, 0); }

  get segments() {
    const groups = this.store.orderStatusGroups();
    let offset = 0;
    return groups.map(g => {
      const seg = { color: g.color, dasharray: `${g.percentage} ${100 - g.percentage}`, dashoffset: `${-offset}`, label: g.label };
      offset += g.percentage;
      return seg;
    });
  }
}

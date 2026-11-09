import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardStore } from '../../state/dashboard.store';

@Component({
  selector: 'app-dashboard-kpi-section',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="grid grid-cols-2 gap-5 sm:grid-cols-4">
      @for (metric of store.metrics(); track metric.label; let i = $index) {
      <div class="relative rounded-sm border border-[var(--color-border)] bg-white p-4 transition-all duration-200 hover:border-[var(--color-border-hover)]">
        <div class="mb-2 flex items-center justify-between">
          <span class="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--color-text-tertiary)]">{{ metric.label }}</span>
          @if (metric.icon) {
            <span class="flex h-7 w-7 items-center justify-center rounded-sm bg-[var(--color-bg)] text-xs">{{ metric.icon }}</span>
          }
        </div>
        <p class="m-0 text-2xl font-black tracking-tight text-[var(--color-text-primary)]">{{ metric.value }}</p>
        <div class="mt-2">
          @if (metric.trendDirection === 'up') {
            <span class="inline-flex items-center rounded-full bg-[#d1fae5] px-2 py-0.5 text-[10px] font-bold text-[#059669]">↑ {{ metric.trend }}</span>
          } @else if (metric.trendDirection === 'down') {
            <span class="inline-flex items-center rounded-full bg-[#fee2e2] px-2 py-0.5 text-[10px] font-bold text-[#dc2626]">↓ {{ metric.trend }}</span>
          } @else {
            <span class="inline-flex items-center rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-text-tertiary)]">{{ metric.trend }}</span>
          }
        </div>
      </div>
      }
    </section>
  `
})
export class DashboardKpiSectionComponent {
  readonly store = inject(DashboardStore);
}

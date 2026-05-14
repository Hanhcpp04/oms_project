import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardStore, GrowthPoint } from '../../state/dashboard.store';

@Component({
  selector: 'app-dashboard-revenue-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rounded-2xl border border-[var(--color-border)] bg-white">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
        <div>
          <h3 class="m-0 text-sm font-bold text-[var(--color-text-primary)]">Biểu đồ tăng trưởng</h3>
          <p class="m-0 mt-0.5 text-xs text-[var(--color-text-tertiary)]">Doanh thu 12 tháng gần nhất</p>
        </div>
        <div class="rounded-xl bg-[var(--color-bg)] px-4 py-2 text-right">
          <p class="m-0 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]">Tổng doanh thu</p>
          <p class="m-0 mt-0.5 text-lg font-black text-[var(--color-text-primary)]">{{ formatCurrency(totalRevenue) }}</p>
        </div>
      </div>
      <div class="p-4">
        <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" class="h-auto w-full" style="min-height: 200px">
          <defs>
            <linearGradient id="revAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--color-text-primary)" stop-opacity="0.08"/>
              <stop offset="100%" stop-color="var(--color-text-primary)" stop-opacity="0"/>
            </linearGradient>
          </defs>
          @for (y of gridY; track y; let i = $index) {
            <line [attr.x1]="P" [attr.y1]="y" [attr.x2]="W-P" [attr.y2]="y" stroke="#e5e7eb" stroke-width="1" stroke-dasharray="4,4"/>
            <text [attr.x]="P - 4" [attr.y]="y + 3" text-anchor="end" class="fill-[var(--color-text-tertiary)] text-[9px]">
              {{ gridLabels[i] }}
            </text>
          }
          <path [attr.d]="areaPath" fill="url(#revAreaGrad)"/>
          <path [attr.d]="linePath" fill="none" stroke="var(--color-text-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          @for (pt of points; track pt.x; let i = $index) {
            <g class="cursor-pointer">
              <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="16" class="fill-transparent"/>
              <circle [attr.cx]="pt.x" [attr.cy]="pt.y" r="3.5" class="fill-white stroke-[var(--color-text-primary)]" stroke-width="2"/>
              <text [attr.x]="pt.x" [attr.y]="H - 4" text-anchor="middle" class="fill-[var(--color-text-tertiary)] text-[10px] font-semibold">
                {{ data[i].month }}
              </text>
            </g>
          }
        </svg>
      </div>
    </div>
  `
})
export class DashboardRevenueChartComponent {
  readonly store = inject(DashboardStore);
  readonly W = 720;
  readonly H = 220;
  readonly P = 48;

  get data(): GrowthPoint[] { return this.store.growth(); }
  get totalRevenue(): number { return this.data.reduce((s, d) => s + d.revenue, 0); }

  get maxRevenue(): number { return Math.max(...this.data.map(p => p.revenue), 1); }

  get points() {
    const d = this.data;
    if (!d.length) return [];
    const max = this.maxRevenue;
    const uw = this.W - this.P * 2, uh = this.H - 60, top = 16;
    return d.map((p, i) => ({ x: this.P + (i / (d.length - 1)) * uw, y: top + uh - (p.revenue / max) * uh }));
  }

  get gridY(): number[] {
    const uh = this.H - 60, top = 16;
    return [0, 1, 2, 3, 4].map(i => top + (i / 4) * uh);
  }

  get gridLabels(): string[] {
    const max = this.maxRevenue;
    return [0, 1, 2, 3, 4].map(i => {
      const v = max - (i / 4) * max;
      return v >= 1_000_000 ? (v / 1_000_000).toFixed(0) + 'tr' : (v / 1_000).toFixed(0) + 'k';
    });
  }

  get linePath(): string {
    const pts = this.points;
    if (pts.length < 2) return '';
    let p = `M${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const cx = pts[i].x + (pts[i + 1].x - pts[i].x) / 2;
      p += ` C${cx},${pts[i].y} ${cx},${pts[i + 1].y} ${pts[i + 1].x},${pts[i + 1].y}`;
    }
    return p;
  }

  get areaPath(): string {
    const pts = this.points;
    if (pts.length < 2) return '';
    const bY = this.H - 44;
    let p = `M${pts[0].x},${bY} L${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const cx = pts[i].x + (pts[i + 1].x - pts[i].x) / 2;
      p += ` C${cx},${pts[i].y} ${cx},${pts[i + 1].y} ${pts[i + 1].x},${pts[i + 1].y}`;
    }
    p += ` L${pts[pts.length - 1].x},${bY} Z`;
    return p;
  }

  formatCurrency(v: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(v);
  }
}

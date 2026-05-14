import { inject } from '@angular/core';
import { DashboardStore } from '../state/dashboard.store';

export interface ChartPoint {
  x: number;
  y: number;
}

export abstract class DashboardViewBase {
  readonly store = inject(DashboardStore);

  protected readonly chartWidth: number = 640;
  protected readonly chartHeight: number = 180;
  protected readonly chartPadding: number = 24;

  protected get chartPoints(): ChartPoint[] {
    const data = this.store.growth();
    if (data.length === 0) return [];

    const maxRevenue = Math.max(...data.map(d => d.revenue));
    const usableWidth = this.chartWidth - this.chartPadding * 2;
    const usableHeight = this.chartHeight - 80;
    const topY = 30;

    return data.map((point, i) => ({
      x: this.chartPadding + (i / (data.length - 1)) * usableWidth,
      y: topY + usableHeight - (point.revenue / maxRevenue) * usableHeight
    }));
  }

  protected get linePath(): string {
    const points = this.chartPoints;
    if (points.length === 0) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  }

  protected get areaPath(): string {
    const points = this.chartPoints;
    if (points.length === 0) return '';
    const bottomY = this.chartHeight - 50;
    return `M${points[0].x},${bottomY} ${points.map(p => `L${p.x},${p.y}`).join(' ')} L${points[points.length - 1].x},${bottomY} Z`;
  }

  protected get gridLines(): number[] {
    const usableHeight = this.chartHeight - 80;
    const topY = 30;
    return [0, 1, 2, 3, 4].map(i => topY + (i / 4) * usableHeight);
  }

  protected formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
  }

  protected getBarHeight(revenue: number): number {
    const max = Math.max(...this.store.revenue().map(r => r.revenue));
    return max > 0 ? (revenue / max) * 100 : 0;
  }

  protected getStatusLabel(status: string): string {
    switch (status) {
      case 'NEW': return 'Mới';
      case 'PROCESSING': return 'Đang xử lý';
      case 'SHIPPED': return 'Đã giao';
      case 'COMPLETED': return 'Hoàn thành';
      case 'CANCELLED': return 'Đã hủy';
      default: return status;
    }
  }
}

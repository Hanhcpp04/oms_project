import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DashboardViewBase } from './dashboard-view-base';
import { CommonModule } from '@angular/common';
import { UiCardComponent } from '../../../shared/components/ui/ui-card.component';
import { UiStatCardComponent } from '../../../shared/components/ui/ui-stat-card.component';

@Component({
  selector: 'app-dashboard-year-view',
  standalone: true,
  imports: [CommonModule, UiCardComponent, UiStatCardComponent],
  templateUrl: './dashboard-year-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardYearViewComponent extends DashboardViewBase {
  override readonly chartHeight = 360;
  override readonly chartWidth = 960;
  override readonly chartPadding = 40;

  get totalYearRevenue(): number {
    return this.store.growth().reduce((sum, g) => sum + g.revenue, 0);
  }

  override get linePath(): string {
    const points = this.chartPoints;
    if (points.length === 0) return '';
    
    let path = `M${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const cp1x = p1.x + (p2.x - p1.x) / 2;
      const cp1y = p1.y;
      const cp2x = p1.x + (p2.x - p1.x) / 2;
      const cp2y = p2.y;
      path += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return path;
  }

  override get areaPath(): string {
    const points = this.chartPoints;
    if (points.length === 0) return '';
    const bottomY = this.chartHeight - 50;
    
    let path = `M${points[0].x},${bottomY} L${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const cp1x = p1.x + (p2.x - p1.x) / 2;
      const cp1y = p1.y;
      const cp2x = p1.x + (p2.x - p1.x) / 2;
      const cp2y = p2.y;
      path += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    path += ` L${points[points.length - 1].x},${bottomY} Z`;
    return path;
  }
}

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { PageTitleComponent } from '../../../shared/components/ui/page-title.component';
import { DashboardPeriod, DashboardStore } from '../state/dashboard.store';

import { DashboardAllViewComponent } from '../components/dashboard-all-view.component';
import { DashboardDayViewComponent } from '../components/dashboard-day-view.component';
import { DashboardMonthViewComponent } from '../components/dashboard-month-view.component';
import { DashboardYearViewComponent } from '../components/dashboard-year-view.component';
import { DashboardRangeViewComponent } from '../components/dashboard-range-view.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule, 
    PageTitleComponent,
    DashboardAllViewComponent,
    DashboardDayViewComponent,
    DashboardMonthViewComponent,
    DashboardYearViewComponent,
    DashboardRangeViewComponent
  ],
  templateUrl: './dashboard-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly store = inject(DashboardStore);
  protected readonly period = signal<DashboardPeriod>('all');

  ngOnInit(): void {
    const rawPeriod = this.route.snapshot.data['period'];
    const period = this.normalizePeriod(rawPeriod);
    this.period.set(period);

    this.store.loadByPeriod(period, {
      from: this.route.snapshot.queryParamMap.get('from') ?? undefined,
      to: this.route.snapshot.queryParamMap.get('to') ?? undefined
    });
  }

  protected getTitle(): string {
    switch (this.period()) {
      case 'day': return 'Theo ngày';
      case 'month': return 'Theo tháng';
      case 'year': return 'Theo năm';
      case 'range': return 'Khoảng ngày';
      default: return 'Tổng quan';
    }
  }

  protected getDescription(): string {
    switch (this.period()) {
      case 'day': return 'Tổng quan đơn hàng và doanh thu trong ngày.';
      case 'month': return 'Hiệu suất tháng hiện tại.';
      case 'year': return 'Xu hướng theo từng tháng.';
      case 'range': return 'Báo cáo trong khoảng ngày đã chọn.';
      default: return 'Tổng quan nhanh về doanh thu và đơn hàng.';
    }
  }

  private normalizePeriod(value: unknown): DashboardPeriod {
    switch (value) {
      case 'day': case 'month': case 'year': case 'range': case 'all': return value;
      default: return 'all';
    }
  }
}
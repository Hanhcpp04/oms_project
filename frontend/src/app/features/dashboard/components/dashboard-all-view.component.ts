import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DashboardViewBase } from './dashboard-view-base';
import { CommonModule } from '@angular/common';
import { DashboardKpiSectionComponent } from './sections/dashboard-kpi-section.component';
import { DashboardRevenueChartComponent } from './sections/dashboard-revenue-chart.component';
import { DashboardOrderStatusComponent } from './sections/dashboard-order-status.component';
import { DashboardRecentOrdersComponent } from './sections/dashboard-recent-orders.component';
import { DashboardStaffSectionComponent } from './sections/dashboard-staff-section.component';
import { DashboardWeeklyRevenueComponent } from './sections/dashboard-weekly-revenue.component';

@Component({
  selector: 'app-dashboard-all-view',
  standalone: true,
  imports: [
    CommonModule,
    DashboardKpiSectionComponent,
    DashboardRevenueChartComponent,
    DashboardOrderStatusComponent,
    DashboardRecentOrdersComponent,
    DashboardStaffSectionComponent,
    DashboardWeeklyRevenueComponent
  ],
  templateUrl: './dashboard-all-view.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardAllViewComponent extends DashboardViewBase {}

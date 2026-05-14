import { Routes } from '@angular/router';
import { DashboardPageComponent } from './pages/dashboard-page.component';
import { EmployeeStatsPageComponent } from './pages/employee-stats-page.component';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'all'
  },
  {
    path: 'employees',
    component: EmployeeStatsPageComponent,
    data: { breadcrumb: 'Theo nhân viên' }
  },
  {
    path: 'all',
    component: DashboardPageComponent,
    data: { period: 'all', breadcrumb: 'Tất cả' }
  },
  {
    path: 'day',
    component: DashboardPageComponent,
    data: { period: 'day', breadcrumb: 'Theo ngày' }
  },
  {
    path: 'month',
    component: DashboardPageComponent,
    data: { period: 'month', breadcrumb: 'Theo tháng' }
  },
  {
    path: 'year',
    component: DashboardPageComponent,
    data: { period: 'year', breadcrumb: 'Theo năm' }
  },
  {
    path: 'range',
    component: DashboardPageComponent,
    data: { period: 'range', breadcrumb: 'Khoảng thời gian' }
  }
];
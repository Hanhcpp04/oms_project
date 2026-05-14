import { inject, Injectable, signal } from '@angular/core';
import { DashboardApiService } from './dashboard-api.service';

export type DashboardPeriod = 'all' | 'day' | 'month' | 'year' | 'range';

export interface DashboardRangeFilter {
  from?: string;
  to?: string;
}

export interface DashboardMetric {
  label: string;
  value: number | string;
  trend: string;
  trendDirection: 'up' | 'down' | 'neutral';
  icon?: string;
}

export interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  status: 'PENDING' | 'NEW' | 'CONFIRMED' | 'PACKING' | 'SHIPPED' | 'DONE' | 'CANCELLED' | 'DEPOSITED' | 'PAID' | 'RENTING' | 'OVERDUE' | 'RETURNED';
  total: number;
  createdAt: string;
  orderType: 'SELL' | 'RENT';
  sourceMethod: 'MANUAL' | 'AI_PARSE' | 'PUBLIC_FORM';
  paymentStatus: 'UNPAID' | 'DEPOSITED' | 'PAID';
}

export interface RevenueData {
  label: string;
  revenue: number;
  orders: number;
}

export interface EmployeeStatistic {
  id: string;
  name: string;
  avatarInitials: string;
  ordersHandled: number;
  revenue: number;
}

export interface GrowthPoint {
  month: string;
  revenue: number;
  orders: number;
}

export interface OrderStatusGroup {
  status: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private readonly dashboardApiService = inject(DashboardApiService);
  readonly periodState = signal<DashboardPeriod>('all');
  readonly loading = signal<boolean>(false);

  private readonly metricsState = signal<DashboardMetric[]>([]);
  private readonly recentOrdersState = signal<RecentOrder[]>([]);
  private readonly revenueState = signal<RevenueData[]>([]);
  private readonly growthState = signal<GrowthPoint[]>([]);
  private readonly employeeStatsState = signal<EmployeeStatistic[]>([]);
  private readonly orderStatusGroupsState = signal<OrderStatusGroup[]>([]);

  readonly metrics = this.metricsState.asReadonly();
  readonly recentOrders = this.recentOrdersState.asReadonly();
  readonly revenue = this.revenueState.asReadonly();
  readonly growth = this.growthState.asReadonly();
  readonly employeeStats = this.employeeStatsState.asReadonly();
  readonly orderStatusGroups = this.orderStatusGroupsState.asReadonly();

  readonly totalRevenue = () => this.revenueState().reduce((sum, d) => sum + d.revenue, 0);
  readonly totalWeekOrders = () => this.revenueState().reduce((sum, d) => sum + d.orders, 0);

  loadByPeriod(period: DashboardPeriod, _range?: DashboardRangeFilter): void {
    this.periodState.set(period);
    this.loading.set(true);

    this.dashboardApiService.getSummary().subscribe({
      next: (data) => {
        // Map metrics from API
        this.metricsState.set(data.metrics.map(m => ({
          label: m.label,
          value: m.value,
          trend: m.trend,
          trendDirection: (m.trendDirection as 'up' | 'down' | 'neutral') || 'neutral',
          icon: m.icon
        })));

        // Map recent orders from API
        this.recentOrdersState.set(data.recentOrders.map(o => ({
          id: String(o.id),
          orderNumber: o.orderNumber || '',
          customerName: o.customerName || 'Khách hàng',
          status: o.status as RecentOrder['status'],
          total: o.total || 0,
          createdAt: o.createdAt || '',
          orderType: o.orderType as RecentOrder['orderType'],
          sourceMethod: o.sourceMethod as RecentOrder['sourceMethod'],
          paymentStatus: o.paymentStatus as RecentOrder['paymentStatus']
        })));

        // Map order status groups from API
        this.orderStatusGroupsState.set(data.orderStatusGroups.map(g => ({
          status: g.status,
          label: g.label,
          count: g.count,
          percentage: g.percentage,
          color: g.color
        })));

        // Map weekly revenue from API
        this.revenueState.set(data.weeklyRevenue.map(w => ({
          label: w.label,
          revenue: w.revenue || 0,
          orders: w.orders || 0
        })));

        // Map employee stats from API
        this.employeeStatsState.set(data.employeeStats.map(e => ({
          id: String(e.id),
          name: e.name,
          avatarInitials: e.avatarInitials,
          ordersHandled: e.ordersHandled,
          revenue: e.revenue || 0
        })));

        // Map growth data from API
        this.growthState.set(data.growthData.map(g => ({
          month: g.month,
          revenue: g.revenue || 0,
          orders: g.orders || 0
        })));

        this.loading.set(false);
      },
      error: () => {
        // Fallback to empty state on error
        this.metricsState.set([]);
        this.recentOrdersState.set([]);
        this.orderStatusGroupsState.set([]);
        this.revenueState.set([]);
        this.employeeStatsState.set([]);
        this.growthState.set([]);
        this.loading.set(false);
      }
    });
  }
}
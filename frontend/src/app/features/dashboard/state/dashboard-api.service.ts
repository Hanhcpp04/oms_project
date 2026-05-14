import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { HttpService } from '../../../core/http/http.service';

interface ApiEnvelope<T> {
  data: T;
}

export interface DashboardMetricDto {
  label: string;
  value: string;
  trend: string;
  trendDirection: string;
  icon?: string;
}

export interface RecentOrderDto {
  id: number;
  orderNumber: string;
  customerName: string;
  status: string;
  total: number;
  createdAt: string;
  orderType: string;
  sourceMethod: string;
  paymentStatus: string;
}

export interface OrderStatusGroupDto {
  status: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface RevenuePointDto {
  label: string;
  revenue: number;
  orders: number;
}

export interface EmployeeStatDto {
  id: number;
  name: string;
  avatarInitials: string;
  ordersHandled: number;
  revenue: number;
}

export interface GrowthPointDto {
  month: string;
  revenue: number;
  orders: number;
}

export interface DashboardSummaryResponse {
  metrics: DashboardMetricDto[];
  recentOrders: RecentOrderDto[];
  orderStatusGroups: OrderStatusGroupDto[];
  weeklyRevenue: RevenuePointDto[];
  employeeStats: EmployeeStatDto[];
  growthData: GrowthPointDto[];
  totalWeekOrders: number;
  totalWeekRevenue: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly httpService = inject(HttpService);

  getSummary(): Observable<DashboardSummaryResponse> {
    return this.httpService.get<ApiEnvelope<DashboardSummaryResponse>>('/reports/dashboard/summary')
      .pipe(map(res => res.data));
  }
}

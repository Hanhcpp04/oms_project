import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { PageTitleComponent } from '../../../shared/components/ui/page-title.component';
import { UiCardComponent } from '../../../shared/components/ui/ui-card.component';
import { UiBadgeComponent } from '../../../shared/components/ui/ui-badge.component';
import { formatVndCurrency } from '../../../shared/utils/currency.util';
import { DashboardStore } from '../state/dashboard.store';

type EmployeePeriod = 'today' | 'week' | 'month' | 'range';

interface EmployeeOrderDemo {
  id: string;
  orderNumber: string;
  customerName: string;
  status: string;
  total: number;
  handledAt: string;
}

@Component({
  selector: 'app-employee-stats-page',
  standalone: true,
  imports: [CommonModule, PageTitleComponent, UiCardComponent, UiBadgeComponent],
  templateUrl: './employee-stats-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmployeeStatsPageComponent implements OnInit {
  readonly store = inject(DashboardStore);

  readonly selectedEmpId = signal<string | null>(null);
  readonly selectedPeriod = signal<EmployeePeriod>('today');
  readonly customStartDate = signal<string>('');
  readonly customEndDate = signal<string>('');

  readonly periods: { value: EmployeePeriod; label: string }[] = [
    { value: 'today', label: 'Hôm nay' },
    { value: 'week', label: 'Tuần này' },
    { value: 'month', label: 'Tháng này' }
  ];

  readonly currentEmployee = computed(() => {
    const id = this.selectedEmpId();
    if (!id) return null;
    return this.store.employeeStats().find(e => e.id === id) || null;
  });

  // Mock employee orders based on period and employee
  readonly employeeOrders = computed(() => {
    const emp = this.currentEmployee();
    if (!emp) return [];
    
    // Generate some mock orders for this employee
    const period = this.selectedPeriod();
    let count = 5;
    if (period === 'week') count = 20;
    if (period === 'month') count = 50;
    
    const orders: EmployeeOrderDemo[] = [];
    for (let i = 1; i <= count; i++) {
      orders.push({
        id: `${emp.id}-ord-${i}`,
        orderNumber: `ORD-${emp.id}-${1000 + i}`,
        customerName: `Khách hàng ${i} (${period})`,
        status: i % 3 === 0 ? 'COMPLETED' : 'PROCESSING',
        total: 500000 + (i * 15000),
        handledAt: `2026-05-05 10:${String(i).padStart(2, '0')}`
      });
    }
    return orders;
  });

  readonly currentStats = computed(() => {
    const orders = this.employeeOrders();
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    return {
      orderCount: orders.length,
      revenue: totalRevenue
    };
  });

  private readonly selectFirstEmployeeWhenLoaded = effect(() => {
    if (this.selectedEmpId()) {
      return;
    }

    const firstEmployee = this.store.employeeStats()[0];
    if (firstEmployee) {
      this.selectedEmpId.set(firstEmployee.id);
    }
  });

  ngOnInit(): void {
    this.store.loadByPeriod('all');
  }

  selectEmployee(id: string): void {
    this.selectedEmpId.set(id);
  }

  setPeriod(period: EmployeePeriod): void {
    this.selectedPeriod.set(period);
  }

  onCustomDateChange(start: boolean, value: string): void {
    if (start) {
      this.customStartDate.set(value);
    } else {
      this.customEndDate.set(value);
    }
    this.selectedPeriod.set('range');
  }

  protected formatCurrency(value: number): string {
    return formatVndCurrency(value);
  }

  protected getStatusVariant(status: string): 'primary' | 'warning' | 'info' | 'success' | 'danger' {
    switch (status) {
      case 'NEW': return 'primary';
      case 'PROCESSING': return 'warning';
      case 'SHIPPED': return 'info';
      case 'COMPLETED': return 'success';
      case 'CANCELLED': return 'danger';
      default: return 'primary';
    }
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

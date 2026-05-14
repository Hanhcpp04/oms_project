import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { UiBadgeComponent } from '../../../shared/components/ui/ui-badge.component';
import { UiButtonComponent } from '../../../shared/components/ui/ui-button.component';
import { UiCardComponent } from '../../../shared/components/ui/ui-card.component';
import { UiInputComponent } from '../../../shared/components/ui/ui-input.component';
import { UiSelectComponent } from '../../../shared/components/ui/ui-select.component';
import { ORDER_STATUS_OPTIONS } from '../data-access/constants/order-status.constants';
import { Order, OrderStatus, OrderType } from '../data-access/models/order.model';
import { OrdersStore } from '../state/orders.store';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-orders-page',
  standalone: true,
  imports: [
    CommonModule,
    UiInputComponent,
    UiCardComponent,
    UiSelectComponent,
    UiBadgeComponent
  ],
  templateUrl: './orders-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdersPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  readonly store = inject(OrdersStore);
  readonly statusOptions = ORDER_STATUS_OPTIONS;

  searchTerm = '';
  selectedStatus: OrderStatus | '' = '';
  selectedOrderType: OrderType | 'ALL' = 'ALL';
  fromDate = '';
  toDate = '';

  private readonly searchSubject = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.selectedOrderType = this.normalizeOrderType(this.route.snapshot.data['orderType']);
    this.store.loadOrders({ orderType: this.selectedOrderType === 'ALL' ? undefined : this.selectedOrderType });

    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.applyFilters();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.searchSubject.next(value);
  }

  onStatusChange(value: string): void {
    this.selectedStatus = value as OrderStatus | '';
    this.applyFilters();
  }

  onFromDateChange(value: string): void {
    this.fromDate = value;
    this.applyFilters();
  }

  onToDateChange(value: string): void {
    this.toDate = value;
    this.applyFilters();
  }

  applyFilters(): void {
    this.store.loadOrders({
      page: 0, size: 20,
      search: this.searchTerm || undefined,
      status: this.selectedStatus || undefined,
      fromDate: this.fromDate ? `${this.fromDate}T00:00:00` : undefined,
      toDate: this.toDate ? `${this.toDate}T23:59:59` : undefined,
      orderType: this.selectedOrderType === 'ALL' ? undefined : this.selectedOrderType
    });
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = '';
    this.store.loadOrders({
      page: 0, size: 20, search: undefined, status: undefined,
      orderType: this.selectedOrderType === 'ALL' ? undefined : this.selectedOrderType
    });
  }

  openDetail(order: Order): void {
    this.store.selectOrder(order);
    this.router.navigate(['/app/orders', order.id], {
      queryParams: { type: this.getOrderTypeQueryParam() }
    });
  }

  async updateOrderStatus(order: Order, status: string, event?: Event): Promise<void> {
    if (event) {
      event.stopPropagation();
    }
    
    try {
      await this.store.updateOrderStatus(order.id, status as OrderStatus);
      this.notificationService.success(`Cập nhật trạng thái đơn ${order.orderNumber || order.orderCode} thành công`);
    } catch (error) {
      this.notificationService.error('Có lỗi xảy ra khi cập nhật trạng thái');
      // Tải lại danh sách để khôi phục trạng thái cũ trên UI nếu lỗi
      this.store.refresh();
    }
  }

  getStatusVariant(status: string): 'primary' | 'warning' | 'info' | 'success' | 'danger' {
    switch (status) {
      case 'PENDING': return 'warning';
      case 'NEW': return 'primary';
      case 'CONFIRMED': return 'info';
      case 'PACKING': return 'info';
      case 'SHIPPED': return 'info';
      case 'DONE': return 'success';
      case 'CANCELLED': return 'danger';
      case 'DEPOSITED': return 'warning';
      case 'PAID': return 'success';
      case 'RENTING': return 'info';
      case 'OVERDUE': return 'danger';
      case 'RETURNED': return 'success';
      default: return 'primary';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'PENDING': return 'Chờ duyệt';
      case 'NEW': return 'Mới';
      case 'CONFIRMED': return 'Đã xác nhận';
      case 'PACKING': return 'Đang đóng gói';
      case 'SHIPPED': return 'Đã giao hàng';
      case 'DONE': return 'Hoàn thành';
      case 'CANCELLED': return 'Đã hủy';
      case 'DEPOSITED': return 'Đã cọc';
      case 'PAID': return 'Đã thanh toán';
      case 'RENTING': return 'Đang thuê';
      case 'OVERDUE': return 'Quá hạn';
      case 'RETURNED': return 'Đã trả hàng';
      default: return status;
    }
  }

  getPaymentMethodLabel(method?: string): string {
    switch (method) {
      case 'COD': return 'COD';
      case 'BANK_TRANSFER': return 'Chuyển khoản';
      case 'VNPAY': return 'VNPay';
      default: return '—';
    }
  }

  getPaymentStatusLabel(status?: string): string {
    switch (status) {
      case 'PAID': return 'Đã TT';
      case 'DEPOSITED': return 'Đã cọc';
      case 'UNPAID': return 'Chưa TT';
      default: return 'Chưa TT';
    }
  }

  getPaymentStatusClass(status?: string): string {
    switch (status) {
      case 'PAID': return 'text-[var(--color-success-text)]';
      case 'DEPOSITED': return 'text-[var(--color-warning-text)]';
      default: return 'text-[var(--color-text-tertiary)]';
    }
  }

  getPaymentStatusDotClass(status?: string): string {
    switch (status) {
      case 'PAID': return 'bg-[var(--color-success)]';
      case 'DEPOSITED': return 'bg-[var(--color-warning)]';
      default: return 'bg-[var(--color-text-tertiary)]';
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
  }

  formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  }

  private normalizeOrderType(value: unknown): OrderType | 'ALL' {
    if (value === 'RENT' || value === 'SELL') return value;
    return 'ALL';
  }

  private getOrderTypeQueryParam(): 'all' | 'rent' | 'sell' {
    if (this.selectedOrderType === 'RENT') {
      return 'rent';
    }

    if (this.selectedOrderType === 'SELL') {
      return 'sell';
    }

    return 'all';
  }
}
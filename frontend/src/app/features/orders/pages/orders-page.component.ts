import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { UiBadgeComponent } from '../../../shared/components/ui/ui-badge.component';
import { UiInputComponent } from '../../../shared/components/ui/ui-input.component';
import { UiSelectComponent } from '../../../shared/components/ui/ui-select.component';
import { PageTitleComponent } from '../../../shared/components/ui/page-title.component';
import { ORDER_STATUS_OPTIONS } from '../data-access/constants/order-status.constants';
import { Order, OrderStatus, OrderType } from '../data-access/models/order.model';
import { OrdersStore } from '../state/orders.store';
import { NotificationService } from '../../../core/services/notification.service';
import { AppNotificationService } from '../../../core/services/app-notification.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { PermissionService } from '../../../core/services/permission.service';
import { formatVndCurrency } from '../../../shared/utils/currency.util';

@Component({
  selector: 'app-orders-page',
  standalone: true,
  imports: [
    CommonModule,
    PageTitleComponent,
    UiInputComponent,
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
  private readonly appNotificationService = inject(AppNotificationService);
  private readonly authStore = inject(AuthStore);
  private readonly permissionService = inject(PermissionService);
  readonly store = inject(OrdersStore);
  readonly statusOptions = computed(() => this.resolveStatusOptions());
  readonly visibleOrders = computed(() =>
    this.store.orders().filter((order) => this.isOrderTypeAllowed(order.orderType))
  );
  protected readonly newMessengerOrderIds = signal<ReadonlySet<string>>(new Set());

  searchTerm = '';
  selectedStatus: OrderStatus | '' = '';
  selectedOrderType: OrderType | 'ALL' = 'ALL';
  fromDate = '';
  toDate = '';

  private readonly searchSubject = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private readonly newMessengerOrderBadgeTimers = new Map<string, ReturnType<typeof setTimeout>>();

  ngOnInit(): void {
    this.selectedOrderType = this.normalizeOrderType(this.route.snapshot.data['orderType']);
    if (this.redirectIfOrderViewDisabled()) {
      return;
    }

    this.store.loadOrders({ orderType: this.selectedOrderType === 'ALL' ? undefined : this.selectedOrderType });

    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.applyFilters();
    });

    this.connectNotifications();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.newMessengerOrderBadgeTimers.forEach((timerId) => window.clearTimeout(timerId));
    this.newMessengerOrderBadgeTimers.clear();
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

  protected getTitle(): string {
    switch (this.selectedOrderType) {
      case 'RENT':
        return 'Đơn cho thuê';
      case 'SELL':
        return 'Đơn bán hàng';
      default:
        return 'Quản lý đơn hàng';
    }
  }

  protected getDescription(): string {
    switch (this.selectedOrderType) {
      case 'RENT':
        return 'Theo dõi đơn thuê, trạng thái thanh toán, lịch thuê và quá trình trả hàng.';
      case 'SELL':
        return 'Theo dõi đơn bán, thanh toán, vận chuyển và trạng thái xử lý.';
      default:
        return 'Quản lý tất cả đơn hàng bán và cho thuê trong shop.';
    }
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

    if (!this.canUpdateOrderStatus()) {
      this.notificationService.error('Bạn không có quyền cập nhật trạng thái đơn hàng.');
      this.store.refresh();
      return;
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

  getFulfillmentStatusVariant(status?: string): 'primary' | 'warning' | 'info' | 'success' | 'danger' {
    switch (status) {
      case 'PENDING_CONFIRMATION':
      case 'READY_TO_PACK':
      case 'READY_TO_RENT':
        return 'warning';
      case 'PACKING':
      case 'SHIPPED':
      case 'RENTING':
        return 'info';
      case 'DONE':
      case 'RETURNED':
      case 'PAID':
        return 'success';
      case 'CANCELLED':
      case 'OVERDUE':
        return 'danger';
      case 'DEPOSITED':
        return 'warning';
      default:
        return 'primary';
    }
  }

  getFulfillmentStatusLabel(status?: string): string {
    switch (status) {
      case 'PENDING_CONFIRMATION': return 'Chờ xác nhận';
      case 'READY_TO_PACK': return 'Sẵn sàng đóng gói';
      case 'READY_TO_RENT': return 'Sẵn sàng bàn giao';
      case 'PACKING': return 'Đang đóng gói';
      case 'SHIPPED': return 'Đang giao';
      case 'DONE': return 'Hoàn thành';
      case 'CANCELLED': return 'Đã hủy';
      case 'DEPOSITED': return 'Đã cọc';
      case 'RENTING': return 'Đang thuê';
      case 'OVERDUE': return 'Quá hạn';
      case 'RETURNED': return 'Đã trả';
      case 'PAID': return 'Đã thanh toán';
      default: return 'Chưa xác định';
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
    return formatVndCurrency(value);
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

  private redirectIfOrderViewDisabled(): boolean {
    if (this.selectedOrderType === 'RENT' && !this.canUseRent()) {
      void this.router.navigate(['/app/orders', this.canUseSell() ? 'sell' : 'all']);
      return true;
    }

    if (this.selectedOrderType === 'SELL' && !this.canUseSell()) {
      void this.router.navigate(['/app/orders', this.canUseRent() ? 'rent' : 'all']);
      return true;
    }

    return false;
  }

  private canUseSell(): boolean {
    const shop = this.authStore.currentShop();
    return shop ? Boolean(shop.enableSell) : true;
  }

  private canUseRent(): boolean {
    const shop = this.authStore.currentShop();
    return shop ? Boolean(shop.enableRent) : true;
  }

  private isOrderTypeAllowed(type: OrderType): boolean {
    return type === 'SELL' ? this.canUseSell() : this.canUseRent();
  }

  private resolveStatusOptions(): typeof ORDER_STATUS_OPTIONS {
    if (this.canUseRent()) {
      return ORDER_STATUS_OPTIONS;
    }

    return ORDER_STATUS_OPTIONS.filter((option) => !['RENTING', 'OVERDUE', 'RETURNED', 'DEPOSITED'].includes(option.value));
  }

  private connectNotifications(): void {
    this.appNotificationService.events$
      .pipe(takeUntil(this.destroy$))
      .subscribe((notification) => {
        if (notification.entityType !== 'ORDER' || !notification.entityId) {
          return;
        }

        if (notification.type === 'ORDER_CREATED_MESSENGER') {
          this.markNewMessengerOrder(notification.entityId);
        }

        this.store.refresh();
      });
  }

  private markNewMessengerOrder(rawOrderId: number): void {
    const orderId = String(rawOrderId);
    const existingTimer = this.newMessengerOrderBadgeTimers.get(orderId);

    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    this.newMessengerOrderIds.update((ids) => {
      const next = new Set(ids);
      next.add(orderId);
      return next;
    });

    const timerId = window.setTimeout(() => {
      this.newMessengerOrderIds.update((ids) => {
        const next = new Set(ids);
        next.delete(orderId);
        return next;
      });
      this.newMessengerOrderBadgeTimers.delete(orderId);
    }, 60000);

    this.newMessengerOrderBadgeTimers.set(orderId, timerId);
  }

  protected canUpdateOrderStatus(): boolean {
    return this.permissionService.hasPermission('ORDER_UPDATE_STATUS');
  }
}

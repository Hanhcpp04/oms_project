import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { formatPhoneDisplay, normalizePhoneDigits } from '../../../shared/utils/phone-format.util';
import { UiBadgeComponent } from '../../../shared/components/ui/ui-badge.component';
import { UiButtonComponent } from '../../../shared/components/ui/ui-button.component';
import { UiCardComponent } from '../../../shared/components/ui/ui-card.component';
import { OrderPrintModalComponent } from './order-print-modal.component';
import { OrdersApiService } from '../data-access/orders-api.service';
import { Order, OrderType } from '../data-access/models/order.model';
import { OrdersStore } from '../state/orders.store';
import { CustomFieldDisplayEntry, getOrderCustomFieldDisplayEntries } from '../utils/order-custom-fields.util';
import { ORDER_STATUS_OPTIONS } from '../data-access/constants/order-status.constants';
import { NotificationService } from '../../../core/services/notification.service';
import { OrderStatus } from '../data-access/models/order.model';

@Component({
  selector: 'app-order-detail-page',
  standalone: true,
  imports: [CommonModule, UiBadgeComponent, UiButtonComponent, UiCardComponent, OrderPrintModalComponent],
  templateUrl: './order-detail-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ordersApiService = inject(OrdersApiService);
  private readonly notificationService = inject(NotificationService);

  readonly store = inject(OrdersStore);
  readonly statusOptions = ORDER_STATUS_OPTIONS;

  protected readonly order = signal<Order | null>(null);
  protected readonly loading = signal(false);
  protected readonly notFound = signal(false);
  protected readonly isPrintModalOpen = signal(false);

  ngOnInit(): void {
    const orderId = this.route.snapshot.paramMap.get('orderId');

    if (!orderId) {
      this.notFound.set(true);
      return;
    }

    this.resolveOrder(orderId);
  }

  protected goBack(): void {
    const type = this.normalizeType(this.route.snapshot.queryParamMap.get('type'));
    this.router.navigate(['/app/orders', type]);
  }

  protected openPrintModal(): void {
    this.isPrintModalOpen.set(true);
  }

  protected closePrintModal(): void {
    this.isPrintModalOpen.set(false);
  }

  protected goToQrHistory(productId: string | number | undefined): void {
    if (!productId) return;
    this.router.navigate(['/app/products', productId, 'qr-history']);
  }

  protected async updateStatus(status: string): Promise<void> {
    const currentOrder = this.order();
    if (!currentOrder) return;

    try {
      this.loading.set(true);
      const updatedOrder = await this.store.updateOrderStatus(currentOrder.id, status as OrderStatus);
      this.order.set(updatedOrder);
      this.notificationService.success('Đã cập nhật trạng thái đơn hàng thành công');
    } catch (error) {
      this.notificationService.error('Có lỗi xảy ra khi cập nhật trạng thái');
    } finally {
      this.loading.set(false);
    }
  }

  protected getStatusVariant(status: string): 'primary' | 'warning' | 'info' | 'success' | 'danger' {
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

  protected getStatusLabel(status: string): string {
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

  protected getPaymentMethodLabel(method?: string): string {
    switch (method) {
      case 'COD': return 'Thanh toán khi nhận hàng (COD)';
      case 'BANK_TRANSFER': return 'Chuyển khoản ngân hàng';
      case 'VNPAY': return 'Thanh toán qua VNPay';
      default: return 'Chưa chọn';
    }
  }

  protected getPaymentStatusLabel(status?: string): string {
    switch (status) {
      case 'PAID': return 'Đã thanh toán';
      case 'DEPOSITED': return 'Đã đặt cọc';
      case 'UNPAID': return 'Chưa thanh toán';
      default: return 'Chưa thanh toán';
    }
  }

  protected getPaymentStatusDotClass(status?: string): string {
    switch (status) {
      case 'PAID': return 'bg-[var(--color-success)]';
      case 'DEPOSITED': return 'bg-[var(--color-warning)]';
      default: return 'bg-[var(--color-text-tertiary)]';
    }
  }

  protected getPaymentStatusTextClass(status?: string): string {
    switch (status) {
      case 'PAID': return 'text-[var(--color-success-text)]';
      case 'DEPOSITED': return 'text-[var(--color-warning-text)]';
      default: return 'text-[var(--color-text-secondary)]';
    }
  }

  protected formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(value);
  }

  protected formatPhone(phone: string | undefined): string {
    if (!phone) return 'Chưa có';
    return formatPhoneDisplay(normalizePhoneDigits(phone));
  }

  protected formatDate(dateStr: string | undefined): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateStr;
    }
  }

  protected hasCustomFields(order: Order): boolean {
    return this.getCustomFieldEntries(order).length > 0;
  }

  protected getCustomFieldEntries(order: Order): CustomFieldDisplayEntry[] {
    return getOrderCustomFieldDisplayEntries(order);
  }

  private resolveOrder(orderId: string): void {
    const cachedOrder = this.findOrderFromStore(orderId);

    if (cachedOrder) {
      this.order.set(cachedOrder);
      this.notFound.set(false);
      this.store.selectOrder(cachedOrder);
      return;
    }

    this.loading.set(true);

    this.ordersApiService
      .getById(orderId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (order) => {
          this.order.set(order);
          this.notFound.set(false);
          this.store.selectOrder(order);
        },
        error: () => {
          this.notFound.set(true);
        }
      });
  }

  private findOrderFromStore(orderId: string): Order | null {
    const selected = this.store.selectedOrder();

    if (selected?.id === orderId) {
      return selected;
    }

    return this.store.getOrderById(orderId);
  }

  private normalizeType(value: string | null): 'all' | 'rent' | 'sell' {
    if (value === 'rent' || value === 'sell' || value === 'all') {
      return value;
    }

    const orderType = this.order()?.orderType;

    if (orderType === 'RENT') {
      return 'rent';
    }

    if (orderType === 'SELL') {
      return 'sell';
    }

    return 'all';
  }
}

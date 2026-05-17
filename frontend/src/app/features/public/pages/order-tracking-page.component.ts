import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { UiBadgeComponent } from '../../../shared/components/ui/ui-badge.component';
import { formatVndCurrency } from '../../../shared/utils/currency.util';
import { OrderStatus } from '../../orders/data-access/models/order.model';
import { PublicOrderTrackingApiService } from '../data-access/public-order-tracking-api.service';
import { PublicOrderTrackingItem, PublicOrderTrackingOrder } from '../data-access/public-order-tracking.model';

@Component({
  selector: 'app-order-tracking-page',
  standalone: true,
  imports: [CommonModule, UiBadgeComponent],
  templateUrl: './order-tracking-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderTrackingPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly apiService = inject(PublicOrderTrackingApiService);

  protected readonly order = signal<PublicOrderTrackingOrder | null>(null);
  protected readonly loading = signal(false);
  protected readonly notFound = signal(false);

  protected readonly steps: ReadonlyArray<{ status: OrderStatus; label: string }> = [
    { status: 'PENDING', label: 'Chờ duyệt' },
    { status: 'CONFIRMED', label: 'Đã xác nhận' },
    { status: 'PACKING', label: 'Đang chuẩn bị' },
    { status: 'SHIPPED', label: 'Đang giao hàng' },
    { status: 'DONE', label: 'Hoàn thành' }
  ];

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token');

    if (!token) {
      this.notFound.set(true);
      return;
    }

    this.loading.set(true);
    this.apiService
      .getByToken(token)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (order) => {
          this.order.set(order);
          this.notFound.set(false);
        },
        error: () => {
          this.order.set(null);
          this.notFound.set(true);
        }
      });
  }

  protected statusLabel(status: OrderStatus): string {
    switch (status) {
      case 'PENDING': return 'Chờ duyệt';
      case 'NEW': return 'Mới';
      case 'CONFIRMED': return 'Đã xác nhận';
      case 'PACKING': return 'Đang chuẩn bị';
      case 'SHIPPED': return 'Đang giao hàng';
      case 'DONE': return 'Hoàn thành';
      case 'CANCELLED': return 'Đã hủy';
      case 'DEPOSITED': return 'Đã cọc';
      case 'PAID': return 'Đã thanh toán';
      case 'RENTING': return 'Đang thuê';
      case 'OVERDUE': return 'Quá hạn';
      case 'RETURNED': return 'Đã trả';
      default: return status;
    }
  }

  protected statusVariant(status: OrderStatus): 'primary' | 'warning' | 'info' | 'success' | 'danger' {
    switch (status) {
      case 'PENDING':
      case 'DEPOSITED':
        return 'warning';
      case 'CANCELLED':
      case 'OVERDUE':
        return 'danger';
      case 'DONE':
      case 'PAID':
      case 'RETURNED':
        return 'success';
      case 'CONFIRMED':
      case 'PACKING':
      case 'SHIPPED':
      case 'RENTING':
        return 'info';
      default:
        return 'primary';
    }
  }

  protected isStepActive(order: PublicOrderTrackingOrder, stepStatus: OrderStatus): boolean {
    return this.stepIndex(order.status) >= this.stepIndex(stepStatus) && order.status !== 'CANCELLED';
  }

  protected formatCurrency(value: number | undefined): string {
    return formatVndCurrency(value ?? 0);
  }

  protected formatDate(value: string | undefined): string {
    if (!value) {
      return '--';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  protected formatDateOnly(value: string | undefined): string {
    if (!value) {
      return '--';
    }

    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  protected lineTotal(item: PublicOrderTrackingItem): number {
    return item.lineTotal > 0 ? item.lineTotal : item.unitPrice * item.quantity;
  }

  protected itemVariantLabel(item: PublicOrderTrackingItem): string {
    const parts = [item.size, item.color, item.sku ? `SKU ${item.sku}` : null].filter(Boolean);
    return parts.length > 0 ? parts.join(' / ') : '--';
  }

  protected trackItem(index: number, item: PublicOrderTrackingItem): string {
    return `${item.productName}-${item.sku || ''}-${index}`;
  }

  private stepIndex(status: OrderStatus): number {
    const index = this.steps.findIndex((step) => step.status === status);

    if (index >= 0) {
      return index;
    }

    if (status === 'RENTING' || status === 'PAID') {
      return 3;
    }

    if (status === 'RETURNED') {
      return 4;
    }

    return 1;
  }
}

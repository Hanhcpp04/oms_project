import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { UiBadgeComponent } from '../../../shared/components/ui/ui-badge.component';
import { UiCardComponent } from '../../../shared/components/ui/ui-card.component';
import { UiTableComponent } from '../../../shared/components/ui/ui-table.component';
import { formatVndCurrency } from '../../../shared/utils/currency.util';
import { Order, OrderStatus } from '../data-access/models/order.model';

@Component({
  selector: 'app-order-table',
  standalone: true,
  imports: [CommonModule, UiTableComponent, UiCardComponent, UiBadgeComponent],
  templateUrl: './order-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderTableComponent {
  @Input({ required: true }) orders: Order[] = [];
  @Input() loading = false;
  @Input() selectedOrderId: string | null = null;

  @Output() select = new EventEmitter<Order>();

  statusVariant(status: OrderStatus): 'primary' | 'warning' | 'info' | 'success' | 'danger' {
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

  statusLabel(status: OrderStatus): string {
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

  formatCurrency(value: number): string {
    return formatVndCurrency(value);
  }
}

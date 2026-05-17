import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { Order } from '../data-access/models/order.model';
import { CustomFieldDisplayEntry, getOrderCustomFieldDisplayEntries } from '../utils/order-custom-fields.util';
import { AuthStore } from '../../../core/auth/auth.store';
import { formatVndCurrency } from '../../../shared/utils/currency.util';
import { inject } from '@angular/core';

@Component({
  selector: 'app-order-print-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-print-modal.component.html',
  styleUrl: './order-print-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderPrintModalComponent {
  @Input({ required: true }) open = false;
  @Input({ required: true }) order: Order | null = null;

  @Output() readonly closed = new EventEmitter<void>();

  readonly authStore = inject(AuthStore);

  protected close(): void {
    this.closed.emit();
  }

  protected printNow(): void {
    window.print();
  }

  protected formatCurrency(value: number): string {
    return formatVndCurrency(value);
  }

  protected hasCustomFields(order: Order): boolean {
    return this.getCustomFieldEntries(order).length > 0;
  }

  protected getCustomFieldEntries(order: Order): CustomFieldDisplayEntry[] {
    return getOrderCustomFieldDisplayEntries(order);
  }

  protected getStatusLabel(status: string): string {
    switch (status) {
      case 'NEW':
        return 'Mới';
      case 'PROCESSING':
        return 'Đang xử lý';
      case 'SHIPPED':
        return 'Đã giao';
      case 'COMPLETED':
        return 'Hoàn thành';
      case 'CANCELLED':
        return 'Đã hủy';
      default:
        return status;
    }
  }

  protected getShopAddress(): string {
    const shop = this.authStore.currentShop();
    if (!shop || !shop.addresses || shop.addresses.length === 0) {
      return 'Chưa thiết lập';
    }
    
    // Find default address or use the first one
    const defaultAddress = shop.addresses.find(a => a.isDefault) || shop.addresses[0];
    
    const parts = [defaultAddress.addressLine];
    if (defaultAddress.ward) parts.push(defaultAddress.ward);
    if (defaultAddress.district) parts.push(defaultAddress.district);
    if (defaultAddress.province) parts.push(defaultAddress.province);
    
    return parts.join(', ');
  }
}

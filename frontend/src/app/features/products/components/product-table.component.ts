import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { UiBadgeComponent } from '../../../shared/components/ui/ui-badge.component';
import { UiButtonComponent } from '../../../shared/components/ui/ui-button.component';
import { UiCardComponent } from '../../../shared/components/ui/ui-card.component';
import { UiTableComponent } from '../../../shared/components/ui/ui-table.component';
import { Product, ProductType } from '../data-access/models/product.model';

import { ProductQrCodeModalComponent } from './product-qr-code-modal.component';

@Component({
  selector: 'app-product-table',
  standalone: true,
  imports: [CommonModule, UiTableComponent, UiCardComponent, UiBadgeComponent, UiButtonComponent, ProductQrCodeModalComponent],
  templateUrl: './product-table.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductTableComponent {
  @Input({ required: true }) products: Product[] = [];
  @Input() loading = false;
  @Input() selectedProductId: string | null = null;

  @Output() select = new EventEmitter<Product>();
  @Output() deactivate = new EventEmitter<Product>();

  protected qrProduct = signal<Product | null>(null);

  protected onQrClick(event: MouseEvent, product: Product): void {
    event.stopPropagation();
    this.qrProduct.set(product);
  }

  protected resolveTypeLabel(type: ProductType): string {
    switch (type) {
      case 'SELL':
        return 'Bán';
      case 'RENT':
        return 'Cho thuê';
      case 'SELL_RENT':
        return 'Bán + Thuê';
      default:
        return type;
    }
  }

  protected resolveTotalStock(product: Product): number {
    return product.variants.reduce((total, variant) => total + Math.max(variant.stockQty, 0), 0);
  }

  protected resolvePriceLabel(product: Product): string {
    const sellPrices = product.variants
      .map((variant) => variant.priceSell)
      .filter((value): value is number => typeof value === 'number');

    const rentPrices = product.variants
      .map((variant) => variant.priceRentPerDay)
      .filter((value): value is number => typeof value === 'number');

    if (sellPrices.length === 0 && rentPrices.length === 0) {
      return '--';
    }

    const minSell = sellPrices.length > 0 ? Math.min(...sellPrices) : null;
    const minRent = rentPrices.length > 0 ? Math.min(...rentPrices) : null;

    if (minSell !== null && minRent === null) {
      return `${this.currency(minSell)} bán`;
    }

    if (minSell === null && minRent !== null) {
      return `${this.currency(minRent)}/ngày`;
    }

    return `${this.currency(minSell ?? 0)} + ${this.currency(minRent ?? 0)}/ngày`;
  }

  protected onDeactivateClick(event: MouseEvent, product: Product): void {
    event.stopPropagation();
    this.deactivate.emit(product);
  }

  private currency(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(value);
  }
}

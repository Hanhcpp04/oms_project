import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { formatVndCurrency } from '../../../shared/utils/currency.util';
import { Product, ProductType } from '../data-access/models/product.model';

@Component({
  selector: 'app-product-detail-info',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-detail-info.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductDetailInfoComponent {
  @Input({ required: true }) product!: Product;
  @Input() canEdit = false;
  @Input() canCreateOrder = false;
  @Input() canGenerateQr = false;

  @Output() edit = new EventEmitter<void>();
  @Output() createOrder = new EventEmitter<void>();
  @Output() generateQr = new EventEmitter<void>();
  @Output() hideProduct = new EventEmitter<void>();
  @Output() restoreProduct = new EventEmitter<void>();

  protected get totalStock(): number {
    return this.product.variants.reduce((total, variant) => total + Math.max(variant.stockQty, 0), 0);
  }

  protected get sellPrice(): number | null {
    return this.firstNumber(this.product.variants.map((variant) => variant.priceSell));
  }

  protected get rentPrice(): number | null {
    return this.firstNumber(this.product.variants.map((variant) => variant.priceRentPerDay));
  }

  protected get depositAmount(): number | null {
    return this.firstNumber(this.product.variants.map((variant) => variant.depositAmount).filter((value) => (value ?? 0) > 0));
  }

  protected get typeLabel(): string {
    switch (this.product.productType) {
      case 'SELL':
        return 'Bán';
      case 'RENT':
        return 'Thuê';
      case 'SELL_RENT':
        return 'Bán & Thuê';
      default:
        return this.product.productType;
    }
  }

  protected get typeBadgeClass(): string {
    switch (this.product.productType) {
      case 'SELL':
        return 'bg-slate-100 text-slate-800 border-slate-200 border';
      case 'RENT':
        return 'bg-blue-50 text-blue-800 border-blue-100 border';
      case 'SELL_RENT':
        return 'bg-emerald-50 text-emerald-800 border-emerald-100 border';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200 border';
    }
  }

  protected get stockStateLabel(): string {
    if (this.totalStock <= 0) {
      return 'Hết hàng';
    }

    if (this.totalStock <= 5) {
      return 'Sắp hết';
    }

    return 'Còn hàng';
  }

  protected get stockStateClass(): string {
    if (this.totalStock <= 0) {
      return 'bg-rose-50 text-rose-800 border-rose-100 border';
    }

    if (this.totalStock <= 5) {
      return 'bg-amber-50 text-amber-800 border-amber-100 border';
    }

    return 'bg-emerald-50 text-emerald-800 border-emerald-100 border';
  }

  protected formatCurrency(value: number | null): string {
    return formatVndCurrency(value);
  }

  protected formatDate(value: string): string {
    return new Date(value).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  protected supportsSell(type: ProductType): boolean {
    return type === 'SELL' || type === 'SELL_RENT';
  }

  protected supportsRent(type: ProductType): boolean {
    return type === 'RENT' || type === 'SELL_RENT';
  }

  private firstNumber(values: Array<number | null | undefined>): number | null {
    return values.find((value): value is number => value !== null && value !== undefined) ?? null;
  }
}

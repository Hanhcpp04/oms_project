import { CommonModule, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { formatVndCurrency } from '../../../shared/utils/currency.util';
import { Product, ProductType } from '../data-access/models/product.model';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, NgClass],
  templateUrl: './product-card.component.html',
  host: { class: 'block h-full' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;
  @Input() canCreateOrder = false;

  @Output() viewDetails = new EventEmitter<Product>();
  @Output() createOrder = new EventEmitter<Product>();
  @Output() copyOrderInfo = new EventEmitter<Product>();

  protected get primaryImage(): string | null {
    return this.product.images[0]?.url ?? null;
  }

  protected get totalStock(): number {
    return this.product.variants.reduce((total, variant) => total + Math.max(variant.stockQty, 0), 0);
  }

  protected get availableVariants(): number {
    return this.product.variants.filter((variant) => variant.stockQty > 0).length;
  }

  protected get sellPrice(): number | null {
    return this.firstNumber(this.product.variants.map((variant) => variant.priceSell));
  }

  protected get rentPrice(): number | null {
    return this.firstNumber(this.product.variants.map((variant) => variant.priceRentPerDay));
  }

  protected get tags(): string[] {
    const variantTags = this.product.variants.flatMap((variant) => [variant.color, variant.size]);
    const customAttributeValues = this.product.customAttributeValues?.map((attribute) => attribute.value) ?? [];
    const fallbackValues = Object.values(this.product.customAttributes ?? {});
    const customTags = (customAttributeValues.length > 0 ? customAttributeValues : fallbackValues)
      .flatMap((value) => Array.isArray(value) ? value : [value]);

    const normalized = [...variantTags, ...customTags]
      .filter((value): value is string | number | boolean => ['string', 'number', 'boolean'].includes(typeof value))
      .map((value) => String(value).trim())
      .filter(Boolean);

    return [...new Set(normalized)];
  }

  protected get stockState(): 'out' | 'low' | 'available' {
    if (this.totalStock <= 0) {
      return 'out';
    }

    if (this.totalStock <= 5) {
      return 'low';
    }

    return 'available';
  }

  protected get stockBadgeLabel(): string {
    if (this.stockState === 'out') {
      return 'Hết hàng';
    }

    if (this.stockState === 'low') {
      return 'Sắp hết';
    }

    return 'Còn hàng';
  }

  protected get stockBadgeClass(): string {
    switch (this.stockState) {
      case 'out':
        return 'bg-red-600/90 text-white';
      case 'low':
        return 'bg-amber-400/95 text-[#3f2a02]';
      default:
        return 'bg-emerald-500/90 text-white';
    }
  }

  protected get typeBadgeLabel(): string {
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
        return 'bg-white/90 text-[#111827]';
      case 'RENT':
        return 'bg-[#111827]/85 text-white';
      case 'SELL_RENT':
        return 'bg-white/90 text-[#111827]';
      default:
        return 'bg-white/90 text-[#111827]';
    }
  }

  protected get supportsSell(): boolean {
    return this.product.productType === 'SELL' || this.product.productType === 'SELL_RENT';
  }

  protected get supportsRent(): boolean {
    return this.product.productType === 'RENT' || this.product.productType === 'SELL_RENT';
  }

  protected formatCurrency(value: number | null): string {
    return formatVndCurrency(value);
  }

  protected onViewDetails(): void {
    this.viewDetails.emit(this.product);
  }

  protected onCreateOrder(event: MouseEvent): void {
    event.stopPropagation();
    this.createOrder.emit(this.product);
  }

  protected onCopyOrderInfo(event: MouseEvent): void {
    event.stopPropagation();
    this.copyOrderInfo.emit(this.product);
  }

  private firstNumber(values: Array<number | null | undefined>): number | null {
    return values.find((value): value is number => value !== null && value !== undefined) ?? null;
  }
}

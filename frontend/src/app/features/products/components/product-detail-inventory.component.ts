import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Product } from '../data-access/models/product.model';

@Component({
  selector: 'app-product-detail-inventory',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-detail-inventory.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductDetailInventoryComponent {
  @Input({ required: true }) product!: Product;

  protected get totalStock(): number {
    return this.product.variants.reduce((total, variant) => total + Math.max(variant.stockQty, 0), 0);
  }

  protected get lowStockCount(): number {
    return this.product.variants.filter((variant) => variant.stockQty > 0 && variant.stockQty <= 3).length;
  }

  protected get outOfStockCount(): number {
    return this.product.variants.filter((variant) => variant.stockQty <= 0).length;
  }

  protected get availableVariants(): number {
    return this.product.variants.filter((variant) => variant.stockQty > 0).length;
  }

  protected get stockPercent(): number {
    const total = this.totalStock;
    if (total <= 0) {
      return 0;
    }

    return Math.min(100, Math.round((this.availableVariants / Math.max(this.product.variants.length, 1)) * 100));
  }
}

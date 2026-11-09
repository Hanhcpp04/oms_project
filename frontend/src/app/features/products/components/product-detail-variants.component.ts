import { CommonModule, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { formatVndCurrency } from '../../../shared/utils/currency.util';
import { Product } from '../data-access/models/product.model';

@Component({
  selector: 'app-product-detail-variants',
  standalone: true,
  imports: [CommonModule, NgClass],
  templateUrl: './product-detail-variants.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductDetailVariantsComponent {
  @Input({ required: true }) product!: Product;
  @Input() canEdit = false;

  @Output() edit = new EventEmitter<void>();

  protected formatCurrency(value: number | null | undefined): string {
    return formatVndCurrency(value);
  }

  protected getVariantName(size: string, color: string): string {
    return [color, size].filter((value) => value && value !== '--').join(' / ') || 'Biến thể mặc định';
  }

  protected get primaryImage(): string | null {
    return this.product.images[0]?.url ?? null;
  }
}

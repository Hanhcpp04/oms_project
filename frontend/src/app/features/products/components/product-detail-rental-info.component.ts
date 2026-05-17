import { CommonModule, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RentalAvailabilityBlock } from '../../../core/services/rental-availability-api.service';
import { Product } from '../data-access/models/product.model';

@Component({
  selector: 'app-product-detail-rental-info',
  standalone: true,
  imports: [CommonModule, NgClass],
  templateUrl: './product-detail-rental-info.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductDetailRentalInfoComponent {
  @Input({ required: true }) product!: Product;
  @Input() days: Array<{ date: string; weekday: string }> = [];
  @Input() blocks: RentalAvailabilityBlock[] = [];
  @Input() selectedVariantId: string | null = null;
  @Input() loading = false;

  @Output() variantChange = new EventEmitter<string>();

  protected setVariant(event: Event): void {
    this.variantChange.emit((event.target as HTMLSelectElement).value);
  }

  protected isDayBlocked(day: string): boolean {
    const variantId = this.selectedVariantId;
    if (!variantId) {
      return false;
    }

    return this.blocks.some((block) =>
      String(block.variantId) === variantId &&
      block.startDate <= day &&
      block.endDate >= day
    );
  }

  protected formatDayLabel(day: string): string {
    const date = new Date(`${day}T00:00:00`);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  }

  protected formatVariantLabel(variant: { size?: string | null; color?: string | null }): string {
    return [variant.color, variant.size].filter(Boolean).join(' / ') || 'Biến thể mặc định';
  }
}

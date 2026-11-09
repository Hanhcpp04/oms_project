import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product } from '../../data-access/models/product.model';
import { OrderType } from '../../../orders/data-access/models/order.model';
import { UiButtonComponent } from '../../../../shared/components/ui/ui-button.component';
import { AuthStore } from '../../../../core/auth/auth.store';
import { formatVndCurrency } from '../../../../shared/utils/currency.util';

export interface SelectedVariant {
  variantId: string | number;
  name: string;
  size: string;
  quantity: number;
  unitPrice: number;
}

@Component({
  selector: 'app-step-select-products',
  standalone: true,
  imports: [CommonModule, UiButtonComponent],
  template: `
    <div class="space-y-6">
      <div class="flex items-center gap-4 p-4 bg-[var(--color-surface-secondary)] rounded-[var(--radius-sm)] border border-[var(--color-border)]">
        @if (product.images[0]?.url) {
          <img [src]="product.images[0].url" alt="Product" class="w-16 h-16 object-cover rounded-[var(--radius-sm)]">
        } @else {
          <div class="w-16 h-16 bg-[var(--color-surface-inset)] rounded-[var(--radius-sm)] flex items-center justify-center text-2xl">🏷️</div>
        }
        <div>
          <h3 class="font-medium text-[var(--color-text-primary)]">{{ product.name }}</h3>
          <p class="text-sm text-[var(--color-text-secondary)] mt-1">
            Chế độ: 
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-info-soft)] text-[var(--color-info-text)]">
              {{ getOrderTypeLabel(selectedOrderType) }}
            </span>
          </p>
        </div>
      </div>

      @if (product.productType === 'SELL_RENT' && canUseSell() && canUseRent()) {
        <div class="grid gap-2">
          <p class="m-0 text-sm font-medium text-[var(--color-text-primary)]">Chọn hình thức đơn</p>
          <div class="grid grid-cols-2 gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-1">
            <button
              type="button"
              class="rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition-colors"
              [class.bg-[var(--color-surface)]]="selectedOrderType === 'SELL'"
              [class.text-[var(--color-accent)]]="selectedOrderType === 'SELL'"
              [class.text-[var(--color-text-secondary)]]="selectedOrderType !== 'SELL'"
              (click)="changeOrderType('SELL')"
            >
              Bán
            </button>
            <button
              type="button"
              class="rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium transition-colors"
              [class.bg-[var(--color-surface)]]="selectedOrderType === 'RENT'"
              [class.text-[var(--color-accent)]]="selectedOrderType === 'RENT'"
              [class.text-[var(--color-text-secondary)]]="selectedOrderType !== 'RENT'"
              (click)="changeOrderType('RENT')"
            >
              Cho thuê
            </button>
          </div>
        </div>
      }

      <div class="space-y-4">
        <h4 class="text-sm font-medium text-[var(--color-text-primary)]">Chọn biến thể</h4>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (variant of product.variants; track variant.id) {
            <div 
              class="border rounded-[var(--radius-sm)] p-4 transition-all duration-200 cursor-pointer"
              [class.border-[var(--color-accent)]]="isVariantSelected(variant.id!)"
              [class.bg-[var(--color-accent-soft)]]="isVariantSelected(variant.id!)"
              [class.border-[var(--color-border)]]="!isVariantSelected(variant.id!)"
              [class.hover:border-[var(--color-border-hover)]]="!isVariantSelected(variant.id!)"
              (click)="toggleVariant(variant.id!)"
            >
              <div class="flex items-start justify-between">
                <div>
                  <div class="font-medium text-[var(--color-text-primary)] flex items-center gap-2">
                    Size {{ variant.size }}
                    @if (variant.color) {
                      <span class="inline-block w-3 h-3 rounded-full border border-[var(--color-border)]" [style.backgroundColor]="variant.color"></span>
                    }
                  </div>
                  <div class="text-sm font-semibold text-[var(--color-text-primary)] mt-1">
                    {{ formatCurrency(getVariantPrice(variant)) }}
                  </div>
                  <div class="text-xs text-[var(--color-text-tertiary)] mt-1">Kho: {{ variant.stockQty }}</div>
                </div>
                
                <!-- Checkbox visual -->
                <div 
                  class="w-5 h-5 rounded border flex items-center justify-center transition-colors"
                  [class.bg-[var(--color-accent)]]="isVariantSelected(variant.id!)"
                  [class.border-[var(--color-accent)]]="isVariantSelected(variant.id!)"
                  [class.border-[var(--color-border)]]="!isVariantSelected(variant.id!)"
                >
                  @if (isVariantSelected(variant.id!)) {
                    <svg class="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                  }
                </div>
              </div>

              <!-- Quantity control (only show if selected) -->
              @if (isVariantSelected(variant.id!)) {
                <div class="mt-4 pt-4 border-t border-[var(--color-border)] flex items-center justify-between" (click)="$event.stopPropagation()">
                  <span class="text-sm text-[var(--color-text-secondary)]">Số lượng:</span>
                  <div class="flex items-center gap-2">
                    <button 
                      type="button" 
                      class="w-8 h-8 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center hover:bg-[var(--color-surface-hover)] transition-colors text-[var(--color-text-primary)]"
                      (click)="updateQuantity(variant.id!, -1)"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/></svg>
                    </button>
                    <span class="w-8 text-center font-medium text-[var(--color-text-primary)]">{{ getQuantity(variant.id!) }}</span>
                    <button 
                      type="button" 
                      class="w-8 h-8 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center hover:bg-[var(--color-surface-hover)] transition-colors text-[var(--color-text-primary)]"
                      (click)="updateQuantity(variant.id!, 1)"
                    >
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between pt-6 mt-6 border-t border-[var(--color-border)]">
        <div class="text-sm">
          <span class="text-[var(--color-text-secondary)]">Tổng tạm tính:</span>
          <span class="ml-2 font-bold text-lg text-[var(--color-text-primary)]">{{ formatCurrency(totalAmount()) }}</span>
        </div>
        <app-ui-button 
          variant="primary" 
          [disabled]="selectedVariants.length === 0"
          (clicked)="next.emit()"
        >
          Tiếp tục
          <svg class="w-4 h-4 ml-2 inline-block" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </app-ui-button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StepSelectProductsComponent {
  private readonly authStore = inject(AuthStore);

  @Input({ required: true }) product!: Product;
  @Input() selectedVariants: SelectedVariant[] = [];
  @Input({ required: true }) selectedOrderType: OrderType = 'SELL';
  @Output() selectionChange = new EventEmitter<SelectedVariant[]>();
  @Output() orderTypeChange = new EventEmitter<OrderType>();
  @Output() next = new EventEmitter<void>();

  totalAmount(): number {
    return this.selectedVariants.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  }

  isVariantSelected(variantId: string | number): boolean {
    return this.selectedVariants.some(v => v.variantId === variantId);
  }

  getQuantity(variantId: string | number): number {
    return this.selectedVariants.find(v => v.variantId === variantId)?.quantity || 1;
  }

  getVariantPrice(variant: any): number {
    return this.selectedOrderType === 'SELL' ? (variant.priceSell || 0) : (variant.priceRentPerDay || 0);
  }

  getOrderTypeLabel(orderType: OrderType): string {
    return orderType === 'SELL' ? 'Bán' : 'Cho thuê';
  }

  changeOrderType(orderType: OrderType): void {
    if (!this.isOrderTypeAllowed(orderType)) {
      return;
    }

    if (this.selectedOrderType === orderType) {
      return;
    }

    this.orderTypeChange.emit(orderType);
    this.selectionChange.emit(this.selectedVariants.map((item) => {
      const variant = this.product.variants?.find((v) => v.id === item.variantId);
      return {
        ...item,
        unitPrice: variant
          ? (orderType === 'SELL' ? (variant.priceSell || 0) : (variant.priceRentPerDay || 0))
          : item.unitPrice
      };
    }));
  }

  toggleVariant(variantId: string | number): void {
    const variant = this.product.variants?.find(v => v.id === variantId);
    if (!variant) return;
    if ((variant.stockQty || 0) <= 0) return;

    const exists = this.isVariantSelected(variantId);
    
    if (exists) {
      this.selectionChange.emit(this.selectedVariants.filter(v => v.variantId !== variantId));
    } else {
      const newItem: SelectedVariant = {
        variantId,
        name: this.product.name,
        size: variant.size,
        quantity: 1,
        unitPrice: this.getVariantPrice(variant)
      };
      this.selectionChange.emit([...this.selectedVariants, newItem]);
    }
  }

  updateQuantity(variantId: string | number, delta: number): void {
    const items = this.selectedVariants.map(item => {
      if (item.variantId === variantId) {
        const variant = this.product.variants?.find(v => v.id === variantId);
        const maxQty = Math.max(variant?.stockQty || 1, 1);
        const newQty = Math.min(maxQty, Math.max(1, item.quantity + delta));
        return { ...item, quantity: newQty };
      }
      return item;
    });
    this.selectionChange.emit(items);
  }

  formatCurrency(value: number): string {
    return formatVndCurrency(value);
  }

  protected canUseSell(): boolean {
    const shop = this.authStore.currentShop();
    return shop ? Boolean(shop.enableSell) : true;
  }

  protected canUseRent(): boolean {
    const shop = this.authStore.currentShop();
    return shop ? Boolean(shop.enableRent) : true;
  }

  private isOrderTypeAllowed(orderType: OrderType): boolean {
    return orderType === 'SELL' ? this.canUseSell() : this.canUseRent();
  }
}

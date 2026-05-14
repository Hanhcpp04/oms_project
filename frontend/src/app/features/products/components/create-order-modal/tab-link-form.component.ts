import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product } from '../../data-access/models/product.model';
import { SelectedVariant } from './step-select-products.component';
import { OrderType } from '../../../orders/data-access/models/order.model';
import { UiButtonComponent } from '../../../../shared/components/ui/ui-button.component';
import { AuthStore } from '../../../../core/auth/auth.store';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-tab-link-form',
  standalone: true,
  imports: [CommonModule, UiButtonComponent],
  template: `
    <div class="space-y-6">
      <div class="bg-[var(--color-info-soft)] p-4 rounded-[var(--radius-lg)] border border-[var(--color-info-text)]/20">
        <h4 class="text-sm font-semibold text-[var(--color-info-text)] flex items-center gap-2">
          <i class="ri-links-line"></i>
          Link tạo đơn hàng Public
        </h4>
        <p class="text-sm text-[var(--color-info-text)]/80 mt-2">
          Gửi link này cho khách hàng. Họ có thể tự điền thông tin và tạo đơn trực tiếp mà không cần bạn phải nhập liệu thủ công.
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1">Link gửi cho khách hàng</label>
        <div class="flex items-center gap-2">
          <input 
            type="text" 
            readonly 
            [value]="generatedLink()" 
            class="flex-1 rounded-[var(--radius-md)] border border-[var(--color-input-border)] bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)] sm:text-sm p-3 outline-none"
          >
          <app-ui-button type="button" variant="primary" (clicked)="copyLink()">
            <i class="ri-clipboard-line mr-1"></i> Copy
          </app-ui-button>
        </div>
      </div>

      <div class="flex items-center justify-between pt-6 mt-6 border-t border-[var(--color-border)]">
        <app-ui-button type="button" variant="ghost" (clicked)="back.emit()">Quay lại</app-ui-button>
        <!-- The user just copies the link, no direct "Create" action here -->
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TabLinkFormComponent {
  @Input({ required: true }) product!: Product;
  @Input({ required: true }) selectedOrderType: OrderType = 'SELL';
  @Input({ required: true }) selectedVariants: SelectedVariant[] = [];
  @Output() back = new EventEmitter<void>();

  private readonly authStore = inject(AuthStore);
  private readonly toast = inject(NotificationService);

  generatedLink(): string {
    const shopSlug = this.authStore.currentShop()?.slug;
    if (!shopSlug) return '';

    const baseUrl = window.location.origin;
    const variantIds = this.selectedVariants.map(v => v.variantId).join(',');
    
    return `${baseUrl}/f/${shopSlug}?p=${this.product.id}&v=${variantIds}&orderType=${this.selectedOrderType}`;
  }

  copyLink() {
    const link = this.generatedLink();
    if (!link) {
      this.toast.error('Không thể tạo link (thiếu thông tin shop)');
      return;
    }

    navigator.clipboard.writeText(link).then(
      () => this.toast.success('Đã copy link!'),
      () => this.toast.error('Không thể copy link')
    );
  }
}

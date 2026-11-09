import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Product } from '../../data-access/models/product.model';
import { SelectedVariant } from './step-select-products.component';
import { UiButtonComponent } from '../../../../shared/components/ui/ui-button.component';
import { OrdersApiService } from '../../../orders/data-access/orders-api.service';
import { AutoOrderDraft, OrderType } from '../../../orders/data-access/models/order.model';
import { NotificationService } from '../../../../core/services/notification.service';
import { finalize } from 'rxjs';
import { TabManualFormComponent } from './tab-manual-form.component';

@Component({
  selector: 'app-tab-ai-parse',
  standalone: true,
  imports: [CommonModule, UiButtonComponent, TabManualFormComponent],
  template: `
    @if (!hasParsed()) {
      <div class="space-y-4">
        <p class="text-sm text-[var(--color-text-secondary)]">
          Paste tin nhắn của khách hàng vào đây. AI sẽ tự động trích xuất Tên, SĐT và Địa chỉ.
        </p>
        
        <textarea 
          [value]="rawText()"
          (input)="rawText.set($any($event.target).value)"
          rows="6" 
          class="w-full rounded-[var(--radius-sm)] border border-[var(--color-input-border)] bg-[var(--color-input-bg)] focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-accent-soft)] transition-colors sm:text-sm resize-none shadow-[var(--shadow-sm)] text-[var(--color-input-text)] p-3 outline-none"
          placeholder="VD: Chào shop, cho mình đặt 1 cái đến Nguyễn Văn A, sđt 0901234567, đ/c 123 Đường 1, Quận 1 nhé."
        ></textarea>

        <div class="flex items-center justify-between pt-4 mt-4 border-t border-[var(--color-border)]">
          <app-ui-button type="button" variant="ghost" (clicked)="back.emit()">Quay lại</app-ui-button>
          <app-ui-button type="button" variant="primary" [disabled]="!rawText().trim() || parsing()" (clicked)="parseText()">
            @if (parsing()) {
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Đang phân tích...
            } @else {
              Phân tích bằng AI
            }
          </app-ui-button>
        </div>
      </div>
    } @else {
      <div class="space-y-4 animate-fade-in-up">
        <div class="bg-[var(--color-accent-soft)] p-4 rounded-[var(--radius-sm)] border border-[var(--color-border)]">
          <p class="text-sm text-[var(--color-accent)] font-medium flex items-center gap-2">
            <i class="ri-magic-line text-lg"></i>
            AI đã phân tích dữ liệu. Vui lòng kiểm tra lại trước khi tạo đơn!
          </p>
        </div>

        <app-tab-manual-form
          [product]="product"
          [selectedOrderType]="selectedOrderType"
          [selectedVariants]="selectedVariants"
          [prefilledDraft]="parsedDraft()"
          sourceMethod="AI_PARSE"
          (back)="hasParsed.set(false)"
          (success)="success.emit($event)"
        />
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TabAiParseComponent {
  @Input({ required: true }) product!: Product;
  @Input({ required: true }) selectedOrderType: OrderType = 'SELL';
  @Input({ required: true }) selectedVariants: SelectedVariant[] = [];
  @Output() back = new EventEmitter<void>();
  @Output() success = new EventEmitter<string>();

  private readonly apiService = inject(OrdersApiService);
  private readonly toast = inject(NotificationService);

  readonly rawText = signal('');
  readonly parsing = signal(false);
  readonly hasParsed = signal(false);
  readonly parsedDraft = signal<AutoOrderDraft | undefined>(undefined);

  parseText() {
    const text = this.rawText().trim();
    if (!text) return;
    const orderTypeHint = this.selectedOrderType;

    this.parsing.set(true);
    this.apiService.cleanOrderText(text, orderTypeHint)
      .pipe(finalize(() => this.parsing.set(false)))
      .subscribe({
        next: (draft) => {
          this.parsedDraft.set(draft);
          this.hasParsed.set(true);
        },
        error: () => {
          this.toast.error('Có lỗi xảy ra khi phân tích bằng AI');
        }
      });
  }
}

import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { UiButtonComponent } from '../../../shared/components/ui/ui-button.component';
import { UiInputComponent } from '../../../shared/components/ui/ui-input.component';
import { UiModalComponent } from '../../../shared/components/ui/ui-modal.component';
import { formatVndCurrency, parseVndCurrencyInput } from '../../../shared/utils/currency.util';
import { Product } from '../data-access/models/product.model';
import { ProductQrCode, ProductsApiService } from '../data-access/products-api.service';

@Component({
  selector: 'app-product-qr-code-modal',
  standalone: true,
  imports: [CommonModule, UiModalComponent, UiButtonComponent, UiInputComponent],
  template: `
    @if (isOpen) {
      <app-ui-modal (closed)="onClose()" title="Tạo QR Thanh Toán">
        <div class="space-y-6">
          <!-- Input Form -->
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5">Sản phẩm</label>
              <p class="text-base font-semibold text-[var(--color-text-primary)]">{{ product?.name }}</p>
            </div>

            <app-ui-input
              label="Số tiền (VND)"
              type="text"
              format="currency"
              [value]="amount().toString()"
              (valueChange)="amount.set(toNumber($event))"
              placeholder="Nhập số tiền"
            />

            <app-ui-input
              label="Nội dung chuyển khoản"
              [value]="note()"
              (valueChange)="note.set($event)"
              placeholder="Ví dụ: Thanh toan {{ product?.name }}"
            />

            <app-ui-button 
              variant="primary" 
              className="w-full"
              [loading]="generating()"
              (clicked)="generateQr()"
            >
              Tạo mã QR
            </app-ui-button>
          </div>

          <!-- QR Display -->
          @if (currentQr()) {
            <div class="p-4 bg-[var(--color-surface-secondary)] rounded-sm flex flex-col items-center border border-[var(--color-border)]">
              <p class="text-sm font-medium mb-3">Quét mã để thanh toán</p>
              <img [src]="currentQr()?.qrUrl" alt="QR Code" class="w-64 h-64 bg-white p-2 rounded-sm shadow-sm mb-4" />
              <div class="text-center">
                <p class="text-sm font-bold text-[var(--color-accent)]">{{ currency(currentQr()?.amount || 0) }}</p>
                <p class="text-xs text-[var(--color-text-tertiary)] mt-1">{{ currentQr()?.note }}</p>
              </div>
            </div>
          }

          <!-- History -->
          <div>
            <h3 class="text-sm font-bold text-[var(--color-text-primary)] mb-3 uppercase tracking-wider">Lịch sử tạo mã</h3>
            @if (loadingHistory()) {
              <p class="text-xs text-[var(--color-text-tertiary)] italic">Đang tải lịch sử...</p>
            } @else if (history().length === 0) {
              <p class="text-xs text-[var(--color-text-tertiary)] italic">Chưa có mã QR nào được tạo cho sản phẩm này.</p>
            } @else {
              <div class="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                @for (item of history(); track item.id) {
                  <div 
                    class="p-3 bg-white border border-[var(--color-border)] rounded-sm flex items-center justify-between cursor-pointer hover:border-[var(--color-accent-soft)] transition-colors"
                    (click)="currentQr.set(item)"
                  >
                    <div>
                      <p class="text-xs font-bold text-[var(--color-text-primary)]">{{ currency(item.amount) }}</p>
                      <p class="text-[10px] text-[var(--color-text-tertiary)]">{{ item.createdAt | date:'dd/MM/yyyy HH:mm' }} • {{ item.createdByFullName }}</p>
                    </div>
                    <i class="ri-qr-code-line text-lg text-[var(--color-text-tertiary)]"></i>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </app-ui-modal>
    }
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar {
      width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: var(--color-border);
      border-radius: 10px;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductQrCodeModalComponent implements OnInit {
  private readonly productsApiService = inject(ProductsApiService);

  @Input() isOpen = false;
  @Input() product: any | null = null;
  @Input() initialAmount?: number;
  @Input() initialNote?: string;
  @Output() close = new EventEmitter<void>();

  protected readonly amount = signal(0);
  protected readonly note = signal('');

  protected readonly generating = signal(false);
  protected readonly loadingHistory = signal(false);
  protected readonly currentQr = signal<ProductQrCode | null>(null);
  protected readonly history = signal<ProductQrCode[]>([]);

  ngOnInit(): void {
    if (this.product) {
      // Default amount: use initialAmount if provided, else first variant, else 0
      const firstVariant = this.product.variants?.[0];
      this.amount.set(this.initialAmount ?? (firstVariant?.priceSell || firstVariant?.priceRentPerDay || 0));
      this.note.set(this.initialNote ?? `Thanh toan ${this.product.name}`);
      this.loadHistory();
    }
  }

  protected generateQr(): void {
    if (!this.product || this.amount() <= 0) return;

    this.generating.set(true);
    this.productsApiService.generateQrCode(this.product.id, this.amount(), this.note())
      .pipe(finalize(() => this.generating.set(false)))
      .subscribe({
        next: (qr: ProductQrCode) => {
          this.currentQr.set(qr);
          this.history.update(h => [qr, ...h]);
        },
        error: (err: any) => {
          console.error('Failed to generate QR', err);
        }
      });
  }

  protected loadHistory(): void {
    if (!this.product) return;

    this.loadingHistory.set(true);
    this.productsApiService.getQrCodeHistory(this.product.id)
      .pipe(finalize(() => this.loadingHistory.set(false)))
      .subscribe({
        next: (history: ProductQrCode[]) => this.history.set(history),
        error: (err: any) => console.error('Failed to load QR history', err)
      });
  }

  protected onClose(): void {
    this.close.emit();
    this.currentQr.set(null);
  }

  protected currency(value: number): string {
    return formatVndCurrency(value);
  }

  protected toNumber(value: string): number {
    return parseVndCurrencyInput(value) ?? 0;
  }
}

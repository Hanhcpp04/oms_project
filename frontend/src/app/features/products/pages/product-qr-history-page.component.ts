import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { UiButtonComponent } from '../../../shared/components/ui/ui-button.component';
import { UiCardComponent } from '../../../shared/components/ui/ui-card.component';
import { formatVndCurrency } from '../../../shared/utils/currency.util';
import { ProductsApiService, ProductQrCode } from '../data-access/products-api.service';
import { ProductQrCodeModalComponent } from '../components/product-qr-code-modal.component';

@Component({
  selector: 'app-product-qr-history-page',
  standalone: true,
  imports: [CommonModule, UiButtonComponent, UiCardComponent, ProductQrCodeModalComponent],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="m-0 text-2xl font-bold text-[var(--color-text-primary)]">Lịch sử QR Thanh toán</h1>
          <p class="m-0 mt-1 text-sm text-[var(--color-text-tertiary)]">
            Quản lý và xem lại tất cả mã QR của sản phẩm
          </p>
        </div>
        <div class="flex items-center gap-3">
          <app-ui-button variant="primary" size="sm" (clicked)="openCreateModal()">
            <i class="ri-add-line mr-1"></i> Tạo mã mới
          </app-ui-button>
          <app-ui-button variant="secondary" size="sm" (clicked)="goBack()">
            <i class="ri-arrow-left-line mr-1"></i> Quay lại
          </app-ui-button>
        </div>
      </div>

      @if (loading()) {
        <app-ui-card className="py-12 text-center text-[var(--color-text-tertiary)]">
          <i class="ri-loader-4-line animate-spin text-2xl mb-2"></i>
          <p>Đang tải lịch sử...</p>
        </app-ui-card>
      } @else if (history().length === 0) {
        <app-ui-card className="py-12 text-center text-[var(--color-text-tertiary)]">
          <i class="ri-qr-code-line text-4xl mb-4 opacity-20"></i>
          <p>Chưa có mã QR nào được tạo cho sản phẩm này.</p>
        </app-ui-card>
      } @else {
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          @for (item of history(); track item.id) {
            <app-ui-card className="group relative overflow-hidden transition-all hover:shadow-sm">
              <div class="flex flex-col items-center">
                <div class="relative group/qr">
                  <img [src]="item.qrUrl" [alt]="item.note" 
                    class="h-48 w-48 rounded-sm border border-[var(--color-border)] bg-white p-2 shadow-sm transition-transform group-hover/qr:scale-105" />
                  <div class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover/qr:opacity-100 transition-opacity rounded-sm">
                    <button (click)="downloadQr(item)" class="p-3 bg-white rounded-full text-black hover:bg-gray-100 transition-colors shadow-sm">
                      <i class="ri-download-2-line text-xl"></i>
                    </button>
                  </div>
                </div>
                
                <div class="mt-4 w-full text-center">
                  <p class="m-0 text-xl font-bold text-[var(--color-accent)]">{{ formatCurrency(item.amount) }}</p>
                  <p class="m-0 mt-1 text-sm font-medium text-[var(--color-text-primary)] truncate" [title]="item.note">
                    {{ item.note }}
                  </p>
                  
                  <div class="mt-4 pt-4 border-t border-[var(--color-border)] text-left space-y-2">
                    <div class="flex items-center justify-between text-xs">
                      <span class="text-[var(--color-text-tertiary)]">Người tạo:</span>
                      <span class="font-medium text-[var(--color-text-secondary)]">{{ item.createdByFullName }}</span>
                    </div>
                    <div class="flex items-center justify-between text-xs">
                      <span class="text-[var(--color-text-tertiary)]">Thời gian:</span>
                      <span class="font-medium text-[var(--color-text-secondary)]">{{ item.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </app-ui-card>
          }
        </div>
      }
    </div>

    <app-product-qr-code-modal 
      [isOpen]="isCreateModalOpen()" 
      [product]="{ id: productId }" 
      (close)="closeCreateModal()" 
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductQrHistoryPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productsApiService = inject(ProductsApiService);

  protected readonly history = signal<ProductQrCode[]>([]);
  protected readonly loading = signal(true);
  protected readonly isCreateModalOpen = signal(false);
  
  protected productId = '';

  ngOnInit(): void {
    this.productId = this.route.snapshot.paramMap.get('productId') || '';
    if (this.productId) {
      this.loadHistory();
    } else {
      this.loading.set(false);
    }
  }

  protected loadHistory(): void {
    this.loading.set(true);
    this.productsApiService.getQrCodeHistory(this.productId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => this.history.set(res),
        error: () => console.error('Failed to load QR history')
      });
  }

  protected goBack(): void {
    window.history.back();
  }

  protected openCreateModal(): void {
    this.isCreateModalOpen.set(true);
  }

  protected closeCreateModal(): void {
    this.isCreateModalOpen.set(false);
    this.loadHistory(); // Refresh history
  }

  protected formatCurrency(value: number): string {
    return formatVndCurrency(value);
  }

  protected async downloadQr(item: ProductQrCode): Promise<void> {
    try {
      const response = await fetch(item.qrUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `QR_${item.amount}_${item.id.slice(0, 8)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed', err);
    }
  }
}

import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { UiButtonComponent } from '../../../shared/components/ui/ui-button.component';
import { UiInputComponent } from '../../../shared/components/ui/ui-input.component';
import { UiCardComponent } from '../../../shared/components/ui/ui-card.component';
import { PaymentConfigService, PaymentConfigDto, VIETNAMESE_BANKS } from '../../../core/services/payment-config.service';
import { NotificationService } from '../../../core/services/notification.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-payment-config-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, UiButtonComponent, UiInputComponent, UiCardComponent],
  template: `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">Cấu hình thanh toán</h1>
        <p class="text-sm text-[var(--color-text-secondary)] mt-1">Bật các phương thức thanh toán mà khách hàng có thể sử dụng khi đặt hàng.</p>
      </div>
    </div>

    @if (loading()) {
      <div class="flex justify-center p-12 text-[var(--color-text-tertiary)]">
        <i class="ri-loader-4-line animate-spin text-3xl"></i>
      </div>
    } @else {
      <form [formGroup]="form" (ngSubmit)="save()" class="space-y-6">

        <!-- COD Card -->
        <app-ui-card>
          <div class="flex items-start justify-between gap-4">
            <div class="flex gap-4 items-start">
              <div class="w-12 h-12 rounded-sm bg-amber-100 flex items-center justify-center shrink-0">
                <i class="ri-money-dollar-circle-line text-2xl text-amber-600"></i>
              </div>
              <div>
                <h2 class="text-base font-bold text-[var(--color-text-primary)]">Thanh toán khi nhận hàng (COD)</h2>
                <p class="text-sm text-[var(--color-text-secondary)] mt-0.5">Khách hàng thanh toán trực tiếp cho người giao hàng khi nhận hàng.</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input type="checkbox" formControlName="codEnabled" class="sr-only peer">
              <div class="w-11 h-6 bg-[var(--color-border)] rounded-full peer peer-checked:bg-[var(--color-accent)] transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
          </div>
        </app-ui-card>

        <!-- Bank Transfer Card -->
        <app-ui-card>
          <div class="flex items-start justify-between gap-4 mb-4">
            <div class="flex gap-4 items-start">
              <div class="w-12 h-12 rounded-sm bg-blue-100 flex items-center justify-center shrink-0">
                <i class="ri-bank-line text-2xl text-blue-600"></i>
              </div>
              <div>
                <h2 class="text-base font-bold text-[var(--color-text-primary)]">Chuyển khoản ngân hàng</h2>
                <p class="text-sm text-[var(--color-text-secondary)] mt-0.5">Hệ thống sẽ tự tạo mã QR VietQR cho khách quét khi đặt hàng.</p>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input type="checkbox" formControlName="bankTransferEnabled" class="sr-only peer">
              <div class="w-11 h-6 bg-[var(--color-border)] rounded-full peer peer-checked:bg-[var(--color-accent)] transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
          </div>

          @if (form.get('bankTransferEnabled')?.value) {
            <div class="border-t border-[var(--color-border)] pt-5 mt-2 space-y-4 animate-in fade-in duration-200">
              <!-- Bank dropdown -->
              <div class="space-y-1.5">
                <label class="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Ngân hàng <span class="text-red-500">*</span></label>
                <select formControlName="bankCode"
                  class="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-secondary)] text-sm px-3 py-2.5 text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)] transition-all">
                  <option value="">-- Chọn ngân hàng --</option>
                  @for (bank of banks; track bank.code) {
                    <option [value]="bank.code">{{ bank.name }} ({{ bank.code }})</option>
                  }
                </select>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <app-ui-input
                  formControlName="bankAccountNumber"
                  label="Số tài khoản"
                  placeholder="VD: 0123456789"
                  [required]="true"
                />
                <app-ui-input
                  formControlName="bankAccountName"
                  label="Tên chủ tài khoản"
                  placeholder="VD: NGUYEN VAN A"
                  [required]="true"
                />
              </div>

              <!-- QR preview -->
              @if (qrPreviewUrl()) {
                <div class="flex flex-col items-center gap-3 pt-2">
                  <p class="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Xem trước mã QR (mẫu)</p>
                  <img [src]="qrPreviewUrl()!" alt="QR Preview"
                    class="w-48 h-48 rounded-sm border-2 border-[var(--color-border)] shadow-sm object-contain bg-white p-2">
                  <p class="text-xs text-[var(--color-text-tertiary)]">Mã QR thực tế sẽ tự động điền số tiền đơn hàng</p>
                </div>
              }
            </div>
          }
        </app-ui-card>

        <!-- VNPay Card -->
        <app-ui-card>
          <div class="flex items-start justify-between gap-4 mb-4">
            <div class="flex gap-4 items-start">
              <div class="w-12 h-12 rounded-sm bg-purple-100 flex items-center justify-center shrink-0">
                <i class="ri-secure-payment-line text-2xl text-purple-600"></i>
              </div>
              <div>
                <h2 class="text-base font-bold text-[var(--color-text-primary)]">Thanh toán qua VNPay</h2>
                <p class="text-sm text-[var(--color-text-secondary)] mt-0.5">Nhập thông tin cổng thanh toán VNPay của shop.</p>
                <span class="inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-600 rounded px-1.5 py-0.5">Sắp ra mắt tích hợp đầy đủ</span>
              </div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input type="checkbox" formControlName="vnpayEnabled" class="sr-only peer">
              <div class="w-11 h-6 bg-[var(--color-border)] rounded-full peer peer-checked:bg-[var(--color-accent)] transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
            </label>
          </div>

          @if (form.get('vnpayEnabled')?.value) {
            <div class="border-t border-[var(--color-border)] pt-5 mt-2 space-y-4 animate-in fade-in duration-200">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <app-ui-input
                  formControlName="vnpayTmnCode"
                  label="Terminal Code (vnp_TmnCode)"
                  placeholder="VD: ABCD1234"
                />
                <app-ui-input
                  formControlName="vnpayHashSecret"
                  label="Hash Secret (vnp_HashSecret)"
                  placeholder="Chuỗi bí mật từ VNPay"
                  type="password"
                />
              </div>
            </div>
          }
        </app-ui-card>

        <!-- Save -->
        <div class="flex justify-end pt-2">
          <app-ui-button type="submit" variant="primary" [disabled]="form.invalid || saving()">
            {{ saving() ? 'Đang lưu...' : 'Lưu cấu hình thanh toán' }}
          </app-ui-button>
        </div>
      </form>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentConfigPageComponent implements OnInit {
  private readonly paymentService = inject(PaymentConfigService);
  private readonly toast = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly banks = VIETNAMESE_BANKS;

  readonly form = this.fb.group({
    codEnabled: [false],
    bankTransferEnabled: [false],
    bankCode: [''],
    bankAccountNumber: [''],
    bankAccountName: [''],
    vnpayEnabled: [false],
    vnpayTmnCode: [''],
    vnpayHashSecret: [''],
  });

  readonly qrPreviewUrl = signal<string | null>(null);

  ngOnInit() {
    this.loadConfig();

    // Live QR preview when bank fields change
    this.form.valueChanges.subscribe(() => this.updateQrPreview());
  }

  private loadConfig() {
    this.loading.set(true);
    this.paymentService.getConfig().pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: (cfg) => {
        this.form.patchValue({
          codEnabled: cfg.codEnabled,
          bankTransferEnabled: cfg.bankTransferEnabled,
          bankCode: cfg.bankCode ?? '',
          bankAccountNumber: cfg.bankAccountNumber ?? '',
          bankAccountName: cfg.bankAccountName ?? '',
          vnpayEnabled: cfg.vnpayEnabled,
          vnpayTmnCode: cfg.vnpayTmnCode ?? '',
          vnpayHashSecret: cfg.vnpayHashSecret ?? '',
        });
        this.updateQrPreview();
      },
      error: () => this.toast.error('Không thể tải cấu hình thanh toán')
    });
  }

  private updateQrPreview() {
    const { bankCode, bankAccountNumber, bankAccountName } = this.form.value;
    if (bankCode && bankAccountNumber && bankAccountName) {
      const name = encodeURIComponent(bankAccountName.trim().toUpperCase());
      const addInfo = encodeURIComponent('Thanh toan don hang');
      this.qrPreviewUrl.set(
        `https://img.vietqr.io/image/${bankCode}-${bankAccountNumber}-compact.png?accountName=${name}&addInfo=${addInfo}`
      );
    } else {
      this.qrPreviewUrl.set(null);
    }
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);

    const val = this.form.value as PaymentConfigDto;
    this.paymentService.saveConfig(val).pipe(
      finalize(() => this.saving.set(false))
    ).subscribe({
      next: () => this.toast.success('Lưu cấu hình thanh toán thành công!'),
      error: (err) => this.toast.error(err.error?.message || 'Có lỗi xảy ra')
    });
  }
}

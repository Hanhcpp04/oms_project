import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { UiButtonComponent } from '../../../shared/components/ui/ui-button.component';
import { UiInputComponent } from '../../../shared/components/ui/ui-input.component';
import { UiCardComponent } from '../../../shared/components/ui/ui-card.component';
import { UiModalComponent } from '../../../shared/components/ui/ui-modal.component';
import { ShippingMethodService, ShippingMethodDto, FeePolicy } from '../../../core/services/shipping-method.service';
import { NotificationService } from '../../../core/services/notification.service';
import { formatVndCurrency } from '../../../shared/utils/currency.util';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-shipping-method-management-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, UiButtonComponent, UiInputComponent, UiCardComponent, UiModalComponent],
  template: `
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">Phương thức vận chuyển</h1>
        <p class="text-sm text-[var(--color-text-secondary)] mt-1">Cấu hình các phương thức vận chuyển và chính sách thu phí cho đơn hàng.</p>
      </div>
      <app-ui-button (click)="openModal()">+ Thêm phương thức</app-ui-button>
    </div>

    <section class="mt-6">
      <app-ui-card>
        @if (loading()) {
          <div class="flex justify-center p-5 text-[var(--color-text-tertiary)]">
             <i class="ri-loader-4-line animate-spin text-2xl"></i>
          </div>
        } @else {
          <div class="grid gap-3">
            @for (method of methods(); track method.id) {
              <div class="flex items-start justify-between rounded-[var(--radius-sm)] border border-[var(--color-border)] p-4 hover:border-[var(--color-accent)]/30 transition-all">
                <div>
                  <div class="flex items-center gap-2">
                    <h3 class="m-0 text-sm font-bold text-[var(--color-text-primary)]">{{ method.name }}</h3>
                    @if (method.active) {
                      <span class="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 uppercase">Hoạt động</span>
                    } @else {
                      <span class="rounded bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 uppercase">Tạm ẩn</span>
                    }
                  </div>
                  <p class="mt-1 text-xs text-[var(--color-text-secondary)] flex items-center gap-1.5">
                    <span class="inline-block w-2 h-2 rounded-full" 
                      [ngClass]="{
                        'bg-blue-400': method.feePolicy === 'FREESHIP',
                        'bg-amber-400': method.feePolicy === 'CUSTOMER_PAYS_SHIPPER',
                        'bg-emerald-400': method.feePolicy === 'FIXED_FEE'
                      }"></span>
                    {{ getPolicyLabel(method.feePolicy) }}
                    @if (method.feePolicy === 'FIXED_FEE') {
                      <strong class="text-[var(--color-text-primary)] ml-1">{{ formatCurrency(method.defaultFee || 0) }}</strong>
                    }
                  </p>
                </div>
                <div class="flex gap-2">
                  <button class="text-xs font-semibold text-[var(--color-text-tertiary)] hover:text-[var(--color-accent)] transition-colors" (click)="editMethod(method)">Sửa</button>
                  <button class="text-xs font-semibold text-red-400 hover:text-red-600 transition-colors" (click)="deleteMethod(method.id!)">Xóa</button>
                </div>
              </div>
            } @empty {
              <div class="py-10 text-center text-[var(--color-text-tertiary)] border border-dashed rounded-[var(--radius-sm)] border-[var(--color-border)]">
                <p class="text-sm">Chưa có phương thức vận chuyển nào.</p>
                <button class="mt-2 text-xs text-[var(--color-accent)] font-semibold hover:underline" (click)="openModal()">Thêm ngay</button>
              </div>
            }
          </div>
        }
      </app-ui-card>
    </section>

    @if (showModal()) {
      <app-ui-modal 
        [title]="editingId() ? 'Sửa phương thức vận chuyển' : 'Thêm phương thức vận chuyển'" 
        (closed)="closeModal()"
      >
        <form [formGroup]="form" (ngSubmit)="saveMethod()" class="space-y-4 pt-2">
          <app-ui-input 
            formControlName="name"
            label="Tên phương thức hiển thị"
            placeholder="VD: Giao hàng nhanh, Giao tiêu chuẩn..."
            [required]="true"
          />

          <div class="space-y-2">
            <label class="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">Chính sách thu phí</label>
            <div class="grid gap-2">
              <label class="flex items-center gap-2 p-3 border rounded-[var(--radius-sm)] cursor-pointer transition-all"
                [class.border-[var(--color-accent)]]="form.get('feePolicy')?.value === 'FREESHIP'"
                [class.bg-[var(--color-accent)]]="form.get('feePolicy')?.value === 'FREESHIP'"
                [class.bg-opacity-5]="form.get('feePolicy')?.value === 'FREESHIP'"
              >
                <input type="radio" formControlName="feePolicy" value="FREESHIP" class="text-[var(--color-accent)] focus:ring-[var(--color-accent)]">
                <div>
                  <div class="text-sm font-semibold text-[var(--color-text-primary)]">Miễn phí giao hàng (Freeship)</div>
                  <div class="text-xs text-[var(--color-text-tertiary)] mt-0.5">Phí vận chuyển sẽ luôn là 0đ</div>
                </div>
              </label>

              <label class="flex items-center gap-2 p-3 border rounded-[var(--radius-sm)] cursor-pointer transition-all"
                [class.border-[var(--color-accent)]]="form.get('feePolicy')?.value === 'CUSTOMER_PAYS_SHIPPER'"
                [class.bg-[var(--color-accent)]]="form.get('feePolicy')?.value === 'CUSTOMER_PAYS_SHIPPER'"
                [class.bg-opacity-5]="form.get('feePolicy')?.value === 'CUSTOMER_PAYS_SHIPPER'"
              >
                <input type="radio" formControlName="feePolicy" value="CUSTOMER_PAYS_SHIPPER" class="text-[var(--color-accent)] focus:ring-[var(--color-accent)]">
                <div>
                  <div class="text-sm font-semibold text-[var(--color-text-primary)]">Khách trả cước cho Shipper</div>
                  <div class="text-xs text-[var(--color-text-tertiary)] mt-0.5">Phí vận chuyển trên hóa đơn là 0đ, khách thanh toán riêng lúc nhận</div>
                </div>
              </label>

              <label class="flex items-center gap-2 p-3 border rounded-[var(--radius-sm)] cursor-pointer transition-all"
                [class.border-[var(--color-accent)]]="form.get('feePolicy')?.value === 'FIXED_FEE'"
                [class.bg-[var(--color-accent)]]="form.get('feePolicy')?.value === 'FIXED_FEE'"
                [class.bg-opacity-5]="form.get('feePolicy')?.value === 'FIXED_FEE'"
              >
                <input type="radio" formControlName="feePolicy" value="FIXED_FEE" class="text-[var(--color-accent)] focus:ring-[var(--color-accent)]">
                <div>
                  <div class="text-sm font-semibold text-[var(--color-text-primary)]">Thu phí cố định</div>
                  <div class="text-xs text-[var(--color-text-tertiary)] mt-0.5">Shop cấu hình sẵn một mức phí ship đồng giá</div>
                </div>
              </label>
            </div>
          </div>

          @if (form.get('feePolicy')?.value === 'FIXED_FEE') {
            <app-ui-input 
              formControlName="defaultFee"
              type="text"
              format="currency"
              label="Mức phí (VNĐ)"
              placeholder="VD: 30000"
              [required]="true"
            />
          }

          <div class="flex items-center justify-between border-t border-[var(--color-border)] pt-4 mt-2">
            <div class="flex items-center gap-2">
              <input type="checkbox" id="activeCheckbox" formControlName="active" class="rounded text-[var(--color-accent)] focus:ring-[var(--color-accent)]">
              <label for="activeCheckbox" class="text-sm font-medium text-[var(--color-text-primary)] cursor-pointer">Đang hoạt động</label>
            </div>
            
            <div class="flex gap-2">
              <app-ui-button type="button" variant="secondary" (click)="closeModal()">Hủy</app-ui-button>
              <app-ui-button type="submit" variant="primary" [disabled]="form.invalid || saving()">
                {{ saving() ? 'Đang lưu...' : 'Lưu phương thức' }}
              </app-ui-button>
            </div>
          </div>
        </form>
      </app-ui-modal>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShippingMethodManagementPageComponent implements OnInit {
  private readonly shippingService = inject(ShippingMethodService);
  private readonly toast = inject(NotificationService);
  private readonly fb = inject(FormBuilder);

  readonly methods = signal<ShippingMethodDto[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  
  readonly showModal = signal(false);
  readonly editingId = signal<number | null>(null);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    feePolicy: ['FREESHIP' as FeePolicy, Validators.required],
    defaultFee: [0],
    active: [true]
  });

  ngOnInit() {
    this.loadMethods();

    this.form.get('feePolicy')?.valueChanges.subscribe(policy => {
      const feeControl = this.form.get('defaultFee');
      if (policy === 'FIXED_FEE') {
        feeControl?.setValidators([Validators.required, Validators.min(0)]);
      } else {
        feeControl?.clearValidators();
        feeControl?.setValue(0);
      }
      feeControl?.updateValueAndValidity();
    });
  }

  loadMethods() {
    this.loading.set(true);
    this.shippingService.getAllMethods().pipe(
      finalize(() => this.loading.set(false))
    ).subscribe({
      next: (res) => this.methods.set(res),
      error: () => this.toast.error('Lỗi khi tải danh sách phương thức vận chuyển')
    });
  }

  getPolicyLabel(policy: FeePolicy): string {
    switch (policy) {
      case 'FREESHIP': return 'Miễn phí giao hàng';
      case 'CUSTOMER_PAYS_SHIPPER': return 'Khách tự trả cho Shipper';
      case 'FIXED_FEE': return 'Phí đồng giá';
      default: return 'Không xác định';
    }
  }

  formatCurrency(val: number): string {
    return formatVndCurrency(val);
  }

  openModal() {
    this.editingId.set(null);
    this.form.reset({ name: '', feePolicy: 'FREESHIP', defaultFee: 0, active: true });
    this.showModal.set(true);
  }

  editMethod(method: ShippingMethodDto) {
    this.editingId.set(method.id || null);
    this.form.patchValue({
      name: method.name,
      feePolicy: method.feePolicy,
      defaultFee: method.defaultFee || 0,
      active: method.active
    });
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  saveMethod() {
    if (this.form.invalid) return;

    this.saving.set(true);
    const val = {
      ...this.form.value,
      defaultFee: Number(this.form.value.defaultFee || 0)
    } as ShippingMethodDto;
    
    if (val.feePolicy !== 'FIXED_FEE') {
      val.defaultFee = undefined;
    }

    const req$ = this.editingId()
      ? this.shippingService.updateMethod(this.editingId()!, val)
      : this.shippingService.createMethod(val);

    req$.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.toast.success(this.editingId() ? 'Cập nhật thành công' : 'Thêm mới thành công');
        this.closeModal();
        this.loadMethods();
      },
      error: (err) => this.toast.error(err.error?.message || 'Có lỗi xảy ra')
    });
  }

  deleteMethod(id: number) {
    if (confirm('Bạn có chắc chắn muốn xóa phương thức này? Khách hàng sẽ không thể chọn phương thức này nữa.')) {
      this.shippingService.deleteMethod(id).subscribe({
        next: () => {
          this.toast.success('Xóa thành công');
          this.loadMethods();
        },
        error: (err) => this.toast.error(err.error?.message || 'Lỗi khi xóa')
      });
    }
  }
}

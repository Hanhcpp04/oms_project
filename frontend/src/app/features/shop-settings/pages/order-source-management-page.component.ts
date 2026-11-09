import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UiButtonComponent } from '../../../shared/components/ui/ui-button.component';
import { UiInputComponent } from '../../../shared/components/ui/ui-input.component';
import { UiCardComponent } from '../../../shared/components/ui/ui-card.component';
import { NotificationService } from '../../../core/services/notification.service';
import { OrderSourceService, OrderSourceDto } from '../../../core/services/order-source.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-order-source-management-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, UiButtonComponent, UiInputComponent, UiCardComponent],
  template: `
    <div class="p-4">
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">Quản lý Nguồn đơn hàng</h1>
          <p class="text-[var(--color-text-secondary)]">Thiết lập các nền tảng khách hàng đặt đơn (FB, Zalo, Shopee...)</p>
        </div>
        <app-ui-button (clicked)="openCreateModal()" variant="primary">
          <i class="i-lucide-plus mr-2 h-4 w-4"></i>
          Thêm nguồn mới
        </app-ui-button>
      </div>

      @if (loading()) {
        <div class="flex h-64 items-center justify-center">
          <div class="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent"></div>
        </div>
      } @else {
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          @for (source of sources(); track source.id) {
            <app-ui-card tone="default" padding="none" class="relative overflow-hidden">
              <div class="p-5">
                <div class="mb-4 flex items-start justify-between">
                  <div>
                    <h3 class="text-lg font-bold text-[var(--color-text-primary)]">{{ source.name }}</h3>
                    <div class="mt-1 flex items-center gap-2">
                      <span [class]="source.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'" 
                            class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                        {{ source.active ? 'Đang hoạt động' : 'Đã ẩn' }}
                      </span>
                    </div>
                  </div>
                  <div class="flex gap-1">
                    <button (click)="openEditModal(source)" class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors">
                      <i class="i-lucide-edit-2 h-4 w-4"></i>
                    </button>
                    <button (click)="deleteSource(source)" class="flex h-8 w-8 items-center justify-center rounded-full hover:bg-red-50 text-red-500 transition-colors">
                      <i class="i-lucide-trash-2 h-4 w-4"></i>
                    </button>
                  </div>
                </div>
              </div>
            </app-ui-card>
          } @empty {
            <div class="col-span-full py-12 text-center">
              <div class="mb-4 flex justify-center">
                <div class="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-surface-secondary)] text-[var(--color-text-tertiary)]">
                  <i class="i-lucide-layout-grid h-8 w-8"></i>
                </div>
              </div>
              <h3 class="text-lg font-medium text-[var(--color-text-primary)]">Chưa có nguồn đơn hàng nào</h3>
              <p class="mt-1 text-[var(--color-text-secondary)]">Hãy thêm nguồn đầu tiên để quản lý dễ dàng hơn.</p>
              <app-ui-button (clicked)="openCreateModal()" variant="secondary" class="mt-4">
                Thêm ngay
              </app-ui-button>
            </div>
          }
        </div>
      }

      <!-- Modal Add/Edit -->
      @if (showModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div class="w-full max-w-md animate-in fade-in zoom-in duration-200">
            <app-ui-card tone="default" padding="lg" class="shadow-sm">
              <h2 class="mb-6 text-xl font-bold text-[var(--color-text-primary)]">
                {{ editingId() ? 'Cập nhật nguồn' : 'Thêm nguồn đơn hàng' }}
              </h2>
              
              <div class="space-y-4" [formGroup]="sourceForm">
                <app-ui-input label="Tên nguồn / Nền tảng" 
                  placeholder="VD: Facebook, Shopee, Khách trực tiếp..."
                  formControlName="name" />
                
                <div class="flex items-center gap-3 py-2">
                  <input type="checkbox" id="isActive" formControlName="active" 
                    class="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-focus-ring)]">
                  <label for="isActive" class="text-sm font-medium text-[var(--color-text-primary)]">Đang hoạt động</label>
                </div>
              </div>

              <div class="mt-8 flex justify-end gap-3">
                <app-ui-button (clicked)="closeModal()" variant="ghost">Huỷ bỏ</app-ui-button>
                <app-ui-button (clicked)="saveSource()" variant="primary" [disabled]="saving() || sourceForm.invalid">
                  {{ saving() ? 'Đang lưu...' : 'Lưu thông tin' }}
                </app-ui-button>
              </div>
            </app-ui-card>
          </div>
        </div>
      }
    </div>
  `,
  styles: []
})
export class OrderSourceManagementPageComponent implements OnInit {
  private readonly sourceService = inject(OrderSourceService);
  private readonly notification = inject(NotificationService);
  private readonly formBuilder = inject(FormBuilder);

  readonly sources = signal<OrderSourceDto[]>([]);
  readonly loading = signal(true);
  readonly showModal = signal(false);
  readonly saving = signal(false);
  readonly editingId = signal<number | null>(null);

  readonly sourceForm = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    active: [true]
  });

  ngOnInit() {
    this.loadSources();
  }

  loadSources() {
    this.loading.set(true);
    this.sourceService.getAllSources()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data: OrderSourceDto[]) => this.sources.set(data),
        error: () => this.notification.error('Không thể tải danh sách nguồn đơn hàng')
      });
  }

  openCreateModal() {
    this.editingId.set(null);
    this.sourceForm.reset({ name: '', active: true });
    this.showModal.set(true);
  }

  openEditModal(source: OrderSourceDto) {
    this.editingId.set(source.id);
    this.sourceForm.setValue({ name: source.name, active: source.active });
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  saveSource() {
    if (this.sourceForm.invalid) {
      this.sourceForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const formData = this.sourceForm.getRawValue();
    const request = this.editingId() 
      ? this.sourceService.updateSource(this.editingId()!, formData)
      : this.sourceService.createSource(formData);

    request.pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.notification.success(this.editingId() ? 'Cập nhật thành công' : 'Thêm mới thành công');
          this.closeModal();
          this.loadSources();
        },
        error: () => this.notification.error('Có lỗi xảy ra, vui lòng thử lại')
      });
  }

  deleteSource(source: OrderSourceDto) {
    if (confirm(`Bạn có chắc chắn muốn xoá nguồn "${source.name}"?`)) {
      this.sourceService.deleteSource(source.id).subscribe({
        next: () => {
          this.notification.success('Đã xoá nguồn đơn hàng');
          this.loadSources();
        },
        error: () => this.notification.error('Không thể xoá nguồn này')
      });
    }
  }
}

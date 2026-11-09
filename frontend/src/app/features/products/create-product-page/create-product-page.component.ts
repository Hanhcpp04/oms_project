import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { ProductFormComponent } from '../components/product-form/product-form.component';
import { ProductsStore } from '../state/products.store';
import { CreateProductInput } from '../data-access/models/product.model';

@Component({
  selector: 'app-create-product-page',
  standalone: true,
  imports: [CommonModule, ProductFormComponent],
  template: `
    <div class="min-h-full bg-[#f8fafc] px-4 pb-16 pt-2 sm:px-6 lg:px-8">
      <div class="mx-auto grid max-w-[1480px] gap-7">
        <section class="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end xl:justify-between">
          <div class="grid gap-2">
            <nav class="flex items-center gap-2 text-sm font-medium text-[#6b7280]" aria-label="Breadcrumb">
              <span>Sản phẩm</span>
              <svg class="h-4 w-4 text-[#9ca3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="m9 18 6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span class="text-[#111827]">Tạo sản phẩm mới</span>
            </nav>

            <div class="grid gap-1">
              <h1 class="m-0 text-3xl font-bold tracking-normal text-[#111827] sm:text-4xl">
                Tạo sản phẩm mới
              </h1>
              <p class="m-0 max-w-3xl text-sm leading-6 text-[#6b7280] sm:text-base">
                Điền thông tin cơ bản và thêm các biến thể (size, màu sắc) cho sản phẩm của bạn.
              </p>
            </div>
          </div>

          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              class="inline-flex h-11 items-center justify-center rounded-sm border border-[#e5e7eb] bg-white px-5 text-sm font-semibold text-[#111827] shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-200 hover:border-[#d1d5db] hover:bg-[#f9fafb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38bdf8]/30"
              [disabled]="store.creating()"
              (click)="productForm.cancel()"
            >
              Hủy
            </button>
            <button
              type="button"
              class="inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-[#111827] px-5 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(17,24,39,0.16)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111827] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              [disabled]="store.creating() || productForm.uploading()"
              (click)="productForm.submit()"
            >
              @if (store.creating()) {
                <span class="h-4 w-4 rounded-full border-2 border-white/70 border-t-transparent animate-spin"></span>
              }
              Lưu sản phẩm
            </button>
          </div>
        </section>

      <app-product-form
        #productForm
        mode="create"
        [loading]="store.creating()"
        (saved)="onSaved($event)"
        (canceled)="onCanceled()"
      ></app-product-form>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreateProductPageComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly store = inject(ProductsStore);

  protected onSaved(input: CreateProductInput): void {
    this.store.createProduct(input, (success) => {
      if (success) {
        this.goBack();
      }
    });
  }

  protected onCanceled(): void {
    this.goBack();
  }

  private goBack(): void {
    this.router.navigate(['../all'], { relativeTo: this.route });
  }
}

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
    <div class="max-w-[1200px] mx-auto p-4 md:p-6 pb-24">
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-[var(--color-text-primary)]">Tạo Sản Phẩm Mới</h1>
        <p class="text-sm text-[var(--color-text-secondary)] mt-1">
          Điền thông tin cơ bản và thêm các biến thể (size, màu sắc) cho sản phẩm của bạn.
        </p>
      </div>

      <app-product-form
        mode="create"
        [loading]="store.creating()"
        (saved)="onSaved($event)"
        (canceled)="onCanceled()"
      ></app-product-form>
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

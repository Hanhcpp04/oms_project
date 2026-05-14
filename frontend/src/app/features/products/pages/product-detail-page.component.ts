import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { ProductsApiService, ProductsViewMode } from '../data-access/products-api.service';
import { Product, CreateProductInput } from '../data-access/models/product.model';
import { ProductsStore } from '../state/products.store';
import { ProductFormComponent } from '../components/product-form/product-form.component';
import { UiButtonComponent } from '../../../shared/components/ui/ui-button.component';
import { CreateOrderModalComponent } from '../components/create-order-modal/create-order-modal.component';
import { ProductQrCodeModalComponent } from '../components/product-qr-code-modal.component';
import { RentalAvailabilityApiService, RentalAvailabilityBlock } from '../../../core/services/rental-availability-api.service';

@Component({
  selector: 'app-product-detail-page',
  standalone: true,
  imports: [CommonModule, ProductFormComponent, UiButtonComponent, CreateOrderModalComponent, ProductQrCodeModalComponent],
  templateUrl: './product-detail-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productsApiService = inject(ProductsApiService);
  private readonly availabilityApi = inject(RentalAvailabilityApiService);

  readonly store = inject(ProductsStore);

  protected readonly product = signal<Product | null>(null);
  protected readonly loading = signal(false);
  protected readonly notFound = signal(false);
  
  protected readonly mode = signal<'view' | 'edit'>('view');
  protected readonly isCreateOrderModalOpen = signal(false);
  protected readonly isQrModalOpen = signal(false);
  protected readonly availabilityLoading = signal(false);
  protected readonly availabilityBlocks = signal<RentalAvailabilityBlock[]>([]);
  protected readonly selectedAvailabilityVariantId = signal<string | null>(null);

  protected readonly availabilityDays = signal(this.buildAvailabilityDays());

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const productId = params.get('productId');
      if (productId) {
        this.resolveProduct(productId);
      } else {
        this.notFound.set(true);
      }
    });
  }

  protected toggleEditMode(): void {
    this.mode.set(this.mode() === 'view' ? 'edit' : 'view');
  }

  protected goBack(): void {
    const view = this.normalizeView(this.route.snapshot.queryParamMap.get('view'));
    this.router.navigate(['../', view], { relativeTo: this.route });
  }

  protected onOrderCreated(orderId: string): void {
    this.router.navigate(['/app/orders', orderId]);
  }

  protected onSaved(input: CreateProductInput): void {
    const currentProduct = this.product();
    if (!currentProduct) return;

    this.store.updateProduct(currentProduct.id, input);
    // After update, we might want to switch back to view mode
    // We can do this right away or wait for a callback.
    // Assuming optimism, switch back to view
    this.mode.set('view');
    // Also update the local signal so it re-renders immediately
    this.product.update(p => p ? { ...p, ...input } as any : p);
  }

  protected isRentalProduct(product: Product | null | undefined): boolean {
    return product?.productType === 'RENT' || product?.productType === 'SELL_RENT';
  }

  protected setAvailabilityVariant(variantId: string): void {
    this.selectedAvailabilityVariantId.set(variantId);
  }

  protected isAvailabilityDayBlocked(day: string): boolean {
    const variantId = this.selectedAvailabilityVariantId();
    if (!variantId) {
      return false;
    }

    return this.availabilityBlocks().some((block) =>
      String(block.variantId) === variantId &&
      block.startDate <= day &&
      block.endDate >= day
    );
  }

  protected getAvailabilityDayClass(day: string): string {
    return this.isAvailabilityDayBlocked(day)
      ? 'border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C]'
      : 'border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]';
  }

  protected formatDayLabel(day: string): string {
    const date = new Date(`${day}T00:00:00`);
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  }

  protected formatVariantLabel(variant: { size?: string | null; color?: string | null }): string {
    return [variant.size || 'Size', variant.color].filter(Boolean).join(' - ');
  }

  protected onCanceled(): void {
    if (this.mode() === 'edit') {
      this.mode.set('view');
      // Hack to force re-render of form with original data
      const p = this.product();
      this.product.set(null);
      setTimeout(() => this.product.set(p), 0);
    } else {
      this.goBack();
    }
  }

  private resolveProduct(productId: string): void {
    const cachedProduct = this.findProductInStore(productId);

    if (cachedProduct) {
      this.setResolvedProduct(cachedProduct);
      this.notFound.set(false);
      this.store.selectProduct(cachedProduct);
      return;
    }

    this.loading.set(true);

    this.productsApiService
      .getById(productId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (product) => {
          this.setResolvedProduct(product);
          this.notFound.set(false);
          this.store.selectProduct(product);
        },
        error: () => {
          this.notFound.set(true);
        }
      });
  }

  private setResolvedProduct(product: Product): void {
    this.product.set(product);
    const firstVariantId = product.variants[0]?.id ?? null;
    this.selectedAvailabilityVariantId.set(firstVariantId);
    if (this.isRentalProduct(product)) {
      this.loadAvailability(product.id);
    } else {
      this.availabilityBlocks.set([]);
    }
  }

  private loadAvailability(productId: string): void {
    const days = this.availabilityDays();
    this.availabilityLoading.set(true);
    this.availabilityApi.getAvailability({
      productId,
      from: days[0]?.date,
      to: days[days.length - 1]?.date
    })
      .pipe(finalize(() => this.availabilityLoading.set(false)))
      .subscribe({
        next: (blocks) => this.availabilityBlocks.set(blocks),
        error: () => this.availabilityBlocks.set([])
      });
  }

  private buildAvailabilityDays(): Array<{ date: string; weekday: string }> {
    const days: Array<{ date: string; weekday: string }> = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    for (let index = 0; index < 60; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const iso = this.toLocalDateString(date);
      days.push({
        date: iso,
        weekday: date.toLocaleDateString('vi-VN', { weekday: 'short' })
      });
    }

    return days;
  }

  private toLocalDateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private findProductInStore(productId: string): Product | null {
    const selected = this.store.selectedProduct();

    if (selected?.id === productId) {
      return selected;
    }

    return this.store.products().find((product) => product.id === productId) ?? null;
  }

  private normalizeView(value: string | null): ProductsViewMode {
    if (value === 'rent' || value === 'sell' || value === 'all') {
      return value;
    }

    return 'all';
  }
}

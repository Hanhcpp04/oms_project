import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { PermissionService } from '../../../core/services/permission.service';
import { RentalAvailabilityApiService, RentalAvailabilityBlock } from '../../../core/services/rental-availability-api.service';
import { CreateOrderModalComponent } from '../components/create-order-modal/create-order-modal.component';
import { ProductDetailGalleryComponent } from '../components/product-detail-gallery.component';
import { ProductDetailInfoComponent } from '../components/product-detail-info.component';
import { ProductDetailInventoryComponent } from '../components/product-detail-inventory.component';
import { ProductDetailRentalInfoComponent } from '../components/product-detail-rental-info.component';
import { ProductDetailSkeletonComponent } from '../components/product-detail-skeleton.component';
import { ProductDetailVariantsComponent } from '../components/product-detail-variants.component';
import { ProductFormComponent } from '../components/product-form/product-form.component';
import { ProductQrCodeModalComponent } from '../components/product-qr-code-modal.component';
import { ProductsApiService, ProductsViewMode } from '../data-access/products-api.service';
import { CreateProductInput, Product } from '../data-access/models/product.model';
import { ProductsStore } from '../state/products.store';

type ProductDetailTab = 'overview' | 'variants' | 'inventory' | 'rental';

@Component({
  selector: 'app-product-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    ProductFormComponent,
    CreateOrderModalComponent,
    ProductQrCodeModalComponent,
    ProductDetailGalleryComponent,
    ProductDetailInfoComponent,
    ProductDetailInventoryComponent,
    ProductDetailRentalInfoComponent,
    ProductDetailSkeletonComponent,
    ProductDetailVariantsComponent
  ],
  templateUrl: './product-detail-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductDetailPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productsApiService = inject(ProductsApiService);
  private readonly availabilityApi = inject(RentalAvailabilityApiService);
  private readonly authStore = inject(AuthStore);
  private readonly permissionService = inject(PermissionService);

  readonly store = inject(ProductsStore);
  @ViewChild('productForm') productForm?: ProductFormComponent;

  protected readonly product = signal<Product | null>(null);
  protected readonly loading = signal(false);
  protected readonly notFound = signal(false);

  protected readonly mode = signal<'view' | 'edit'>('view');
  protected readonly activeTab = signal<ProductDetailTab>('overview');
  protected readonly isCreateOrderModalOpen = signal(false);
  protected readonly isQrModalOpen = signal(false);
  protected readonly availabilityLoading = signal(false);
  protected readonly availabilityBlocks = signal<RentalAvailabilityBlock[]>([]);
  protected readonly selectedAvailabilityVariantId = signal<string | null>(null);

  protected readonly viewerOpen = signal(false);
  protected readonly selectedViewerImage = signal<string | null>(null);

  protected readonly availabilityDays = signal(this.buildAvailabilityDays());

  protected readonly customAttributeEntries = computed(() => {
    const product = this.product();
    const attributeValues = product?.customAttributeValues ?? [];

    const formatEntry = (label: string, rawValue: unknown) => {
      const values = Array.isArray(rawValue) ? rawValue : [rawValue];
      const items = values
        .filter((v) => v !== null && v !== undefined && v !== '')
        .map(String)
        .map((val) => ({
          value: val,
          isImage: val.startsWith('/api/files/display/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(val)
        }));

      return { label, items };
    };

    if (attributeValues.length > 0) {
      return attributeValues
        .map((attribute) => formatEntry(attribute.label, attribute.value))
        .filter((entry) => entry.items.length > 0);
    }

    return Object.entries(product?.customAttributes ?? {})
      .map(([label, value]) => formatEntry(label, value))
      .filter((entry) => entry.items.length > 0);
  });

  protected readonly tabs = computed<Array<{ label: string; value: ProductDetailTab }>>(() => {
    const base: Array<{ label: string; value: ProductDetailTab }> = [
      { label: 'Tổng quan', value: 'overview' },
      { label: 'Biến thể', value: 'variants' },
      { label: 'Tồn kho', value: 'inventory' }
    ];

    if (this.isRentalProduct(this.product())) {
      base.push({ label: 'Lịch thuê', value: 'rental' });
    }

    return base;
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const productId = params.get('productId');
      if (productId) {
        this.resolveProduct(productId);
      } else {
        this.notFound.set(true);
      }
    });
  }

  protected toggleEditMode(): void {
    if (this.mode() === 'view' && !this.canEditProduct()) {
      return;
    }

    this.mode.set(this.mode() === 'view' ? 'edit' : 'view');
  }

  protected goBack(): void {
    const view = this.normalizeView(this.route.snapshot.queryParamMap.get('view'));
    this.router.navigate(['../', view], { relativeTo: this.route });
  }

  protected setActiveTab(tab: ProductDetailTab): void {
    this.activeTab.set(tab);
  }

  protected openViewer(imageUrl: string): void {
    this.selectedViewerImage.set(imageUrl);
    this.viewerOpen.set(true);
  }

  protected closeViewer(): void {
    this.viewerOpen.set(false);
    this.selectedViewerImage.set(null);
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(event: KeyboardEvent): void {
    if (this.viewerOpen() && event.key === 'Escape') {
      this.closeViewer();
    }
  }

  protected onOrderCreated(orderId: string): void {
    this.router.navigate(['/app/orders', orderId]);
  }

  protected onSaved(input: CreateProductInput): void {
    const currentProduct = this.product();
    if (!currentProduct) {
      return;
    }

    this.store.updateProduct(currentProduct.id, input);
    this.mode.set('view');
    this.product.update((product) => product ? { ...product, ...input } as Product : product);
  }

  protected hideProduct(): void {
    const currentProduct = this.product();
    if (!currentProduct || !currentProduct.active) {
      return;
    }

    this.store.deactivateProduct(currentProduct);
    this.product.set({ ...currentProduct, active: false });
  }

  protected restoreProduct(): void {
    const currentProduct = this.product();
    if (!currentProduct || currentProduct.active) {
      return;
    }

    this.store.restoreProduct(currentProduct, (restoredProduct) => this.product.set(restoredProduct));
  }

  protected isRentalProduct(product: Product | null | undefined): boolean {
    return this.canUseRent() && (product?.productType === 'RENT' || product?.productType === 'SELL_RENT');
  }

  protected canCreateOrder(product: Product | null | undefined): boolean {
    if (!product) {
      return false;
    }

    if (!this.permissionService.hasPermission('ORDER_CREATE')) {
      return false;
    }

    switch (product.productType) {
      case 'SELL':
        return this.canUseSell();
      case 'RENT':
        return this.canUseRent();
      case 'SELL_RENT':
        return this.canUseSell() && this.canUseRent();
    }

    return false;
  }

  protected canGenerateQr(): boolean {
    return this.permissionService.hasPermission('PRODUCT_QR_CREATE');
  }

  protected canEditProduct(): boolean {
    return this.permissionService.hasPermission('PRODUCT_EDIT');
  }

  protected setAvailabilityVariant(variantId: string): void {
    this.selectedAvailabilityVariantId.set(variantId);
  }

  protected formatCustomValue(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    if (Array.isArray(value)) {
      return value.filter(Boolean).join(', ') || '—';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  protected onCanceled(): void {
    if (this.mode() === 'edit') {
      this.mode.set('view');
      const currentProduct = this.product();
      this.product.set(null);
      setTimeout(() => this.product.set(currentProduct), 0);
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
    this.activeTab.set('overview');
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

  private canUseSell(): boolean {
    const shop = this.authStore.currentShop();
    return shop ? Boolean(shop.enableSell) : true;
  }

  private canUseRent(): boolean {
    const shop = this.authStore.currentShop();
    return shop ? Boolean(shop.enableRent) : true;
  }
}

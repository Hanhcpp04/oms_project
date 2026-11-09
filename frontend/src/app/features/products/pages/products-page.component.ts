import { CommonModule, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';
import { NotificationService } from '../../../core/services/notification.service';
import { PermissionService } from '../../../core/services/permission.service';
import { CopyOrderInfoModalComponent } from '../components/copy-order-info-modal.component';
import { CreateOrderModalComponent } from '../components/create-order-modal/create-order-modal.component';
import { ProductCardComponent } from '../components/product-card.component';
import { ProductEmptyStateComponent } from '../components/product-empty-state.component';
import { ProductSkeletonGridComponent } from '../components/product-skeleton-grid.component';
import { ProductsViewMode } from '../data-access/products-api.service';
import { Product, ProductType } from '../data-access/models/product.model';
import { ProductsStore } from '../state/products.store';
import { formatVndCurrency } from '../../../shared/utils/currency.util';

type ProductView = ProductsViewMode;
type ProductFilter = 'ALL' | 'SELL' | 'RENT' | 'SELL_RENT' | 'LOW_STOCK' | 'OUT_OF_STOCK';

interface CategoryTab {
  label: string;
  count: number;
}

import { PageTitleComponent } from '../../../shared/components/ui/page-title.component';
import { UiInputComponent } from '../../../shared/components/ui/ui-input.component';
import { UiSelectComponent } from '../../../shared/components/ui/ui-select.component';

@Component({
  selector: 'app-products-page',
  standalone: true,
  imports: [
    CommonModule,
    NgClass,
    PageTitleComponent,
    UiInputComponent,
    UiSelectComponent,
    CopyOrderInfoModalComponent,
    CreateOrderModalComponent,
    ProductCardComponent,
    ProductEmptyStateComponent,
    ProductSkeletonGridComponent
  ],
  templateUrl: './products-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductsPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  private readonly permissionService = inject(PermissionService);

  readonly store = inject(ProductsStore);
  protected readonly authStore = inject(AuthStore);

  searchTerm = signal('');
  selectedFilter = signal<ProductFilter>('ALL');
  protected selectedCategory = signal('Tất cả');
  protected currentView: ProductView = 'all';

  protected readonly categoryTabs = computed<CategoryTab[]>(() => {
    const shopCats = this.authStore.currentShop()?.categories ?? [];
    const productCats = this.store.products()
      .map((product) => product.category)
      .filter((category): category is string => !!category && category.trim().length > 0);
    const categories = [...new Set([...shopCats, ...productCats])];
    const products = this.productsForSelectedFilter();

    return [
      { label: 'Tất cả', count: products.length },
      ...categories.map((category) => ({
        label: category,
        count: products.filter((product) => product.category === category).length
      }))
    ];
  });

  protected readonly filteredProducts = computed(() => {
    const products = this.productsForSelectedFilter();
    const category = this.selectedCategory();

    if (category === 'Tất cả') {
      return products;
    }

    return products.filter((product) => product.category === category);
  });

  protected readonly visibleProducts = computed(() =>
    this.filteredProducts().filter((product) => this.isProductTypeAllowed(product.productType))
  );

  protected selectedProductForOrder: Product | null = null;
  protected isCreateOrderModalOpen = signal(false);
  protected selectedProductForCopy: Product | null = null;
  protected isCopyOrderInfoModalOpen = signal(false);

  ngOnInit(): void {
    this.currentView = this.normalizeView(this.route.snapshot.data['productView']);
    if (this.redirectIfViewDisabled()) {
      return;
    }

    const initialType = this.getForcedType();
    this.selectedFilter.set(this.filterFromType(initialType));

    this.store.loadProductsByView(this.currentView, {
      page: 0,
      size: 100,
      type: initialType ?? undefined
    });
  }

  selectCategory(category: string): void {
    this.selectedCategory.set(category);
  }

  onSearchInput(event: Event): void {
    this.onSearchChange((event.target as HTMLInputElement).value);
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.applyFilters();
  }

  onFilterChange(value: string): void {
    this.selectedFilter.set((value || 'ALL') as ProductFilter);
    this.applyFilters();
  }

  onFilterSelect(event: Event): void {
    this.onFilterChange((event.target as HTMLSelectElement).value);
  }

  applyFilters(): void {
    const forcedType = this.getForcedType();
    const selectedType = this.filterToProductType(this.selectedFilter());

    this.store.loadProductsByView(this.currentView, {
      page: 0,
      size: 100,
      search: this.searchTerm() || undefined,
      type: forcedType ?? selectedType
    });
  }

  loadProducts(): void {
    this.applyFilters();
  }

  clearFilters(): void {
    const forcedType = this.getForcedType();

    this.searchTerm.set('');
    this.selectedFilter.set(this.filterFromType(forcedType));
    this.selectedCategory.set('Tất cả');
    this.store.loadProductsByView(this.currentView, {
      page: 0,
      size: 100,
      search: undefined,
      type: forcedType ?? undefined
    });
  }

  openCreateForm(): void {
    if (!this.permissionService.hasPermission('PRODUCT_CREATE')) {
      this.notificationService.error('Bạn không có quyền tạo sản phẩm.');
      return;
    }

    this.router.navigate(['../create'], { relativeTo: this.route });
  }

  openDetail(product: Product): void {
    this.store.selectProduct(product);

    this.router.navigate(['../', product.id], {
      relativeTo: this.route,
      queryParams: { view: this.currentView }
    });
  }

  deactivateProduct(product: Product): void {
    this.store.deactivateProduct(product);
  }

  openOrderCreationFlow(product: Product): void {
    if (!this.canCreateOrderForProduct(product)) {
      this.notificationService.error('Bạn không có quyền tạo đơn hàng.');
      return;
    }

    this.selectedProductForOrder = product;
    this.isCreateOrderModalOpen.set(true);
  }

  openCopyOrderInfo(product: Product): void {
    if (!this.canCreateOrderForProduct(product)) {
      this.notificationService.error('Bạn không có quyền tạo đơn hàng.');
      return;
    }

    this.selectedProductForCopy = product;
    this.isCopyOrderInfoModalOpen.set(true);
  }

  closeCopyOrderInfo(): void {
    this.isCopyOrderInfoModalOpen.set(false);
    this.selectedProductForCopy = null;
  }

  onOrderCreated(orderId: string): void {
    this.isCreateOrderModalOpen.set(false);
    this.selectedProductForOrder = null;
    this.router.navigate(['/app/orders', orderId]);
  }

  getTypeLabel(type: ProductType): string {
    switch (type) {
      case 'SELL':
        return 'Bán';
      case 'RENT':
        return 'Thuê';
      case 'SELL_RENT':
        return 'Bán & Thuê';
      default:
        return type;
    }
  }

  formatCurrency(value: number): string {
    return formatVndCurrency(value);
  }

  getUniqueColors(product: Product): string[] {
    const colors = product.variants
      .map((variant) => variant.color)
      .filter((color): color is string => !!color && color.trim().length > 0);
    return [...new Set(colors)];
  }

  getPrimaryImage(product: Product): string | null {
    return product.images[0]?.url ?? null;
  }

  getSellPrice(product: Product): number | null {
    return this.firstNumber(product.variants.map((variant) => variant.priceSell));
  }

  getRentPrice(product: Product): number | null {
    return this.firstNumber(product.variants.map((variant) => variant.priceRentPerDay));
  }

  getDepositAmount(product: Product): number | null {
    return this.firstNumber(product.variants.map((variant) => variant.depositAmount).filter((value) => (value ?? 0) > 0));
  }

  getStockLabel(product: Product): string {
    const totalStock = this.store.getTotalStock(product);

    if (totalStock <= 0) {
      return 'Hết hàng';
    }

    if (totalStock <= 5) {
      return `${totalStock} sắp hết`;
    }

    return `${totalStock} tồn kho`;
  }

  getStockBadgeClass(product: Product): string {
    const totalStock = this.store.getTotalStock(product);

    if (totalStock <= 0) {
      return 'bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]';
    }

    if (totalStock <= 5) {
      return 'bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]';
    }

    return 'bg-[var(--color-success-soft)] text-[var(--color-success-text)]';
  }

  protected getTitle(): string {
    switch (this.currentView) {
      case 'rent':
        return 'Sản phẩm cho thuê';
      case 'sell':
        return 'Sản phẩm bán';
      default:
        return 'Quản lý sản phẩm';
    }
  }

  protected getDescription(): string {
    switch (this.currentView) {
      case 'rent':
        return 'Quản lý danh mục, lịch thuê, tồn kho và giá cho thuê theo ngày.';
      case 'sell':
        return 'Quản lý danh mục, tồn kho và giá bán cho cửa hàng.';
      default:
        return 'Quản lý danh mục, tồn kho, giá bán và cho thuê.';
    }
  }

  protected getViewLabel(): string {
    switch (this.currentView) {
      case 'rent':
        return 'Sản phẩm cho thuê';
      case 'sell':
        return 'Sản phẩm bán';
      default:
        return 'Tất cả sản phẩm';
    }
  }

  protected getFilterOptions(): Array<{ label: string; value: ProductFilter }> {
    const typeOptions: Array<{ label: string; value: ProductFilter; type: ProductType }> = [
      { label: 'Bán', value: 'SELL', type: 'SELL' },
      { label: 'Thuê', value: 'RENT', type: 'RENT' },
      { label: 'Bán & Thuê', value: 'SELL_RENT', type: 'SELL_RENT' }
    ];

    return [
      { label: 'Tất cả', value: 'ALL' },
      ...typeOptions
        .filter((option) => this.currentView === 'all' && this.isProductTypeAllowed(option.type))
        .map(({ label, value }) => ({ label, value })),
      { label: 'Sắp hết hàng', value: 'LOW_STOCK' },
      { label: 'Hết hàng', value: 'OUT_OF_STOCK' }
    ];
  }

  protected hasActiveFilters(): boolean {
    return this.searchTerm().trim().length > 0
      || this.selectedFilter() !== this.filterFromType(this.getForcedType())
      || this.selectedCategory() !== 'Tất cả';
  }

  protected canCreateProduct(): boolean {
    return this.permissionService.hasPermission('PRODUCT_CREATE');
  }

  protected canCreateOrderForProduct(product: Product): boolean {
    return this.permissionService.hasPermission('ORDER_CREATE') && this.isProductTypeAllowed(product.productType);
  }

  private getForcedType(): ProductType | null {
    if (this.currentView === 'rent') {
      return 'RENT';
    }

    if (this.currentView === 'sell') {
      return 'SELL';
    }

    return null;
  }

  private normalizeView(value: unknown): ProductView {
    if (value === 'rent' || value === 'sell' || value === 'all') {
      return value;
    }

    return 'all';
  }

  private redirectIfViewDisabled(): boolean {
    if (this.currentView === 'rent' && !this.canUseRent()) {
      void this.router.navigate(['/app/products', this.canUseSell() ? 'sell' : 'all']);
      return true;
    }

    if (this.currentView === 'sell' && !this.canUseSell()) {
      void this.router.navigate(['/app/products', this.canUseRent() ? 'rent' : 'all']);
      return true;
    }

    return false;
  }

  private isProductTypeAllowed(type: ProductType): boolean {
    switch (type) {
      case 'SELL':
        return this.canUseSell();
      case 'RENT':
        return this.canUseRent();
      case 'SELL_RENT':
        return this.canUseSell() && this.canUseRent();
    }
  }

  private canUseSell(): boolean {
    const shop = this.authStore.currentShop();
    return shop ? Boolean(shop.enableSell) : true;
  }

  private canUseRent(): boolean {
    const shop = this.authStore.currentShop();
    return shop ? Boolean(shop.enableRent) : true;
  }

  private firstNumber(values: Array<number | null | undefined>): number | null {
    return values.find((value): value is number => value !== null && value !== undefined) ?? null;
  }

  private filterFromType(_type: ProductType | null): ProductFilter {
    return 'ALL';
  }

  private filterToProductType(filter: ProductFilter): ProductType | undefined {
    if (filter === 'SELL' || filter === 'RENT' || filter === 'SELL_RENT') {
      return filter;
    }

    return undefined;
  }

  private productsForSelectedFilter(): Product[] {
    const filter = this.selectedFilter();

    return this.store.products()
      .filter((product) => this.isProductTypeAllowed(product.productType))
      .filter((product) => {
        if (filter === 'LOW_STOCK') {
          const totalStock = this.store.getTotalStock(product);
          return totalStock > 0 && totalStock <= 5;
        }

        if (filter === 'OUT_OF_STOCK') {
          return this.store.getTotalStock(product) <= 0;
        }

        const type = this.filterToProductType(filter);
        return type ? product.productType === type : true;
      });
  }
}

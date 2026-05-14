import { CommonModule, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, computed, signal } from '@angular/core';
import { AuthStore } from '../../../core/auth/auth.store';
import { ActivatedRoute, Router } from '@angular/router';
import { FormTemplateService } from '../../../core/services/form-template.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ProductFormTemplateService } from '../../../core/services/product-form-template.service';
import { CreateOrderModalComponent } from '../components/create-order-modal/create-order-modal.component';
import { OrderType } from '../../orders/data-access/models/order.model';
import { OrdersStore } from '../../orders/state/orders.store';
import { UiButtonComponent } from '../../../shared/components/ui/ui-button.component';
import { UiCardComponent } from '../../../shared/components/ui/ui-card.component';
import { UiInputComponent } from '../../../shared/components/ui/ui-input.component';
import { UiSelectComponent } from '../../../shared/components/ui/ui-select.component';
import { ProductsViewMode } from '../data-access/products-api.service';
import { PRODUCT_TYPE_OPTIONS } from '../data-access/constants/product-type.constants';
import { Product, ProductType } from '../data-access/models/product.model';
import { ProductsStore } from '../state/products.store';
import { UiSkeletonComponent } from '../../../shared/components/ui/ui-skeleton.component';

type ProductView = ProductsViewMode;

@Component({
  selector: 'app-products-page',
  standalone: true,
  imports: [
    CommonModule,
    NgClass,
    UiInputComponent,
    UiButtonComponent,
    UiCardComponent,
    UiSelectComponent,
    CreateOrderModalComponent,
    UiSkeletonComponent
  ],
  templateUrl: './products-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductsPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly ordersStore = inject(OrdersStore);
  private readonly formTemplateService = inject(FormTemplateService);
  private readonly productFormTemplateService = inject(ProductFormTemplateService);
  private readonly notificationService = inject(NotificationService);

  readonly store = inject(ProductsStore);
  readonly typeOptions = PRODUCT_TYPE_OPTIONS;
  protected readonly authStore = inject(AuthStore);

  searchTerm = signal('');
  selectedType = signal<ProductType | ''>('');
  protected currentView: ProductView = 'all';

  protected readonly categories = computed(() => {
    const shopCats = this.authStore.currentShop()?.categories ?? [];
    return ['Tất cả', ...shopCats];
  });
  protected selectedCategory = signal('Tất cả');

  protected readonly filteredProducts = computed(() => {
    const products = this.store.products();
    const category = this.selectedCategory();
    
    if (category === 'Tất cả') {
      return products;
    }
    
    return products.filter(p => p.category === category);
  });

  selectCategory(cat: string): void {
    this.selectedCategory.set(cat);
  }

  protected selectedProductForOrder: Product | null = null;
  protected isCreateOrderModalOpen = signal(false);

  constructor() {}

  ngOnInit(): void {
    this.currentView = this.normalizeView(this.route.snapshot.data['productView']);
    const initialType = this.getForcedType();

    this.selectedType.set(initialType ?? '');

    this.store.loadProductsByView(this.currentView, { type: initialType ?? undefined });
  }

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.applyFilters();
  }

  onTypeChange(value: string): void {
    this.selectedType.set(value as ProductType | '');
    this.applyFilters();
  }

  applyFilters(): void {
    const forcedType = this.getForcedType();
    const selectedType = this.selectedType() || undefined;

    this.store.loadProductsByView(this.currentView, {
      page: 0,
      size: 100, // Load more for FE filtering
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
    this.selectedType.set(forcedType ?? '');
    this.selectedCategory.set('Tất cả');
    this.store.loadProductsByView(this.currentView, {
      page: 0,
      size: 100,
      search: undefined,
      type: forcedType ?? undefined
    });
  }

  openCreateForm(): void {
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
    this.selectedProductForOrder = product;
    this.isCreateOrderModalOpen.set(true);
  }

  onOrderCreated(orderId: string): void {
    this.isCreateOrderModalOpen.set(false);
    this.selectedProductForOrder = null;
    this.router.navigate(['/app/orders', orderId]);
  }

  getTypeLabel(type: ProductType): string {
    switch (type) {
      case 'SELL': return 'Bán';
      case 'RENT': return 'Cho thuê';
      case 'SELL_RENT': return 'Bán + Cho thuê';
      default: return type;
    }
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(value);
  }

  getUniqueColors(product: Product): string[] {
    const colors = product.variants
      .map(v => v.color)
      .filter((c): c is string => !!c && c.trim().length > 0);
    return [...new Set(colors)];
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
        return 'Quản lý danh mục sản phẩm phục vụ luồng cho thuê.';
      case 'sell':
        return 'Quản lý danh mục sản phẩm phục vụ luồng bán hàng.';
      default:
        return 'Quản lý danh mục sản phẩm, biến thể tồn kho và giá bán/cho thuê.';
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

  protected isTypeFilterDisabled(): boolean {
    return this.currentView !== 'all';
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
}

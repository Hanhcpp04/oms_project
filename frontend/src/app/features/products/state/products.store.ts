import { computed, inject, Injectable, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { NotificationService } from '../../../core/services/notification.service';
import { ProductsApiService, ProductsViewMode } from '../data-access/products-api.service';
import {
  CreateProductInput,
  CreateProductRequest,
  Product,
  ProductsQuery
} from '../data-access/models/product.model';
import {
  toCreateProductRequest,
  createLocalProduct,
  buildUpdatedLocalProduct,
  filterLocalProducts,
  formatCurrency
} from '../utils/products-store.util';

@Injectable({ providedIn: 'root' })
export class ProductsStore {
  private readonly productsApiService = inject(ProductsApiService);
  private readonly notificationService = inject(NotificationService);

  private readonly localProductsState = signal<Product[]>([]);
  private readonly productsState = signal<Product[]>([]);
  private readonly loadingState = signal(false);
  private readonly creatingState = signal(false);
  private readonly selectedProductState = signal<Product | null>(null);
  private readonly queryState = signal<ProductsQuery>({ page: 0, size: 20 });
  private readonly viewModeState = signal<ProductsViewMode>('all');
  private readonly hasLoadedFromApiState = signal(false);

  readonly products = this.productsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly creating = this.creatingState.asReadonly();
  readonly selectedProduct = this.selectedProductState.asReadonly();

  readonly totalProducts = computed(() => this.productsState().length);
  readonly activeProducts = computed(() => this.productsState().filter((product) => product.active).length);
  readonly lowStockProducts = computed(() =>
    this.productsState().filter((product) => this.getTotalStock(product) > 0 && this.getTotalStock(product) <= 5)
      .length
  );
  readonly totalVariants = computed(() =>
    this.productsState().reduce((total, product) => total + product.variants.length, 0)
  );

  loadProductsByView(view: ProductsViewMode, partialQuery: Partial<ProductsQuery> = {}): void {
    this.viewModeState.set(view);
    this.loadProducts(partialQuery);
  }

  loadProducts(partialQuery: Partial<ProductsQuery> = {}): void {
    const query = { ...this.queryState(), ...partialQuery };
    this.queryState.set(query);
    this.loadingState.set(true);
    const viewMode = this.viewModeState();

    this.productsApiService
      .listByView(viewMode, query)
      .pipe(finalize(() => this.loadingState.set(false)))
      .subscribe({
        next: (response) => {
          const content = response.content ?? [];
          this.productsState.set(content);
          this.hasLoadedFromApiState.set(true);

          if (content.length > 0) {
            this.localProductsState.set(content);
          }

          this.syncSelectedProduct();
        },
        error: () => {
          if (this.hasLoadedFromApiState()) {
            this.notificationService.info('Kết nối API sản phẩm đang gián đoạn. Giữ dữ liệu hiện tại để tránh nhấp nháy.');
            return;
          }

          const fallback = filterLocalProducts(this.localProductsState(), query);
          this.productsState.set(fallback);
          this.syncSelectedProduct();
          this.notificationService.info(this.buildLoadFallbackMessage(viewMode));
        }
      });
  }

  createProduct(input: CreateProductInput, callback?: (success: boolean) => void): void {
    const request = toCreateProductRequest(input);

    if (!request.name.trim()) {
      this.notificationService.error('Vui long nhap ten san pham.');
      return;
    }

    this.creatingState.set(true);

    console.log('[Product Store] Calling API create product with request:', request);

    this.productsApiService
      .create(request)
      .pipe(finalize(() => this.creatingState.set(false)))
      .subscribe({
        next: (product) => {
          const normalizedProduct = product.customAttributes
            ? product
            : { ...product, customAttributes: input.customAttributes };

          this.localProductsState.update((products) => [normalizedProduct, ...products]);
          this.refreshFromCurrentQuery();
          this.selectedProductState.set(normalizedProduct);
          this.notificationService.success(`Da tao san pham ${normalizedProduct.name}.`);
          callback?.(true);
        },
        error: (err) => {
          this.notificationService.error(
            `Tạo sản phẩm thất bại. Vui lòng kiểm tra lại.`
          );
          callback?.(false);
        }
      });
  }

  updateProduct(productId: string, input: CreateProductInput): void {
    const request = toCreateProductRequest(input);

    if (!request.name.trim()) {
      this.notificationService.error('Vui long nhap ten san pham.');
      return;
    }

    const localState = this.localProductsState();
    let current = localState.find((product) => product.id === productId) ?? null;

    if (!current && this.selectedProductState()?.id === productId) {
      current = this.selectedProductState();
      // Add to local state so we can track it
      this.localProductsState.update(products => [...products, current!]);
    }

    if (!current) {
      this.notificationService.error('Không tìm thấy sản phẩm để cập nhật.');
      return;
    }

    this.creatingState.set(true);

    this.productsApiService
      .update(productId, request)
      .pipe(finalize(() => this.creatingState.set(false)))
      .subscribe({
        next: (product) => {
          const normalizedProduct = product.customAttributes
            ? product
            : { ...product, customAttributes: input.customAttributes };

          this.localProductsState.update((products) =>
            products.map((item) => (item.id === productId ? { ...normalizedProduct, createdAt: item.createdAt } : item))
          );
          this.refreshFromCurrentQuery();
          this.selectedProductState.set({ ...normalizedProduct, createdAt: current.createdAt });
          this.notificationService.success(`Da cap nhat san pham ${normalizedProduct.name}.`);
        },
        error: (err) => {
          this.notificationService.error(
            `Cập nhật sản phẩm thất bại. Vui lòng kiểm tra lại.`
          );
        }
      });
  }

  deactivateProduct(product: Product): void {
    const applyLocalDeactivate = (): void => {
      this.localProductsState.update((products) =>
        products.map((item) => {
          if (item.id !== product.id) {
            return item;
          }

          return {
            ...item,
            active: false
          };
        })
      );

      this.productsState.update((products) =>
        products.map((item) => {
          if (item.id !== product.id) {
            return item;
          }

          return {
            ...item,
            active: false
          };
        })
      );

      this.syncSelectedProduct();
    };

    this.productsApiService.deactivate(product.id).subscribe({
      next: () => {
        applyLocalDeactivate();
        this.notificationService.success(`Da ngung hoat dong san pham ${product.name}.`);
      },
      error: (err) => {
        this.notificationService.error('Xóa sản phẩm thất bại. Vui lòng thử lại.');
      }
    });
  }

  selectProduct(product: Product | null): void {
    this.selectedProductState.set(product);
  }

  getTotalStock(product: Product): number {
    return product.variants.reduce((total, variant) => total + Math.max(variant.stockQty, 0), 0);
  }

  getPriceLabel(product: Product): string {
    const sellPrices = product.variants
      .map((variant) => variant.priceSell)
      .filter((value): value is number => typeof value === 'number');

    const rentPrices = product.variants
      .map((variant) => variant.priceRentPerDay)
      .filter((value): value is number => typeof value === 'number');

    if (sellPrices.length === 0 && rentPrices.length === 0) {
      return '--';
    }

    if (sellPrices.length > 0 && rentPrices.length === 0) {
      return `${formatCurrency(Math.min(...sellPrices))} ban`;
    }

    if (sellPrices.length === 0 && rentPrices.length > 0) {
      return `${formatCurrency(Math.min(...rentPrices))}/ngay`;
    }

    return `${formatCurrency(Math.min(...sellPrices))} + ${formatCurrency(Math.min(...rentPrices))}/ngay`;
  }

  private refreshFromCurrentQuery(): void {
    const query = this.queryState();
    this.productsState.set(filterLocalProducts(this.localProductsState(), query));
    this.syncSelectedProduct();
  }

  private syncSelectedProduct(): void {
    const selectedId = this.selectedProductState()?.id;

    if (!selectedId) {
      this.selectedProductState.set(this.productsState()[0] ?? null);
      return;
    }

    const fromVisibleProducts = this.productsState().find((product) => product.id === selectedId) ?? null;

    if (fromVisibleProducts) {
      this.selectedProductState.set(fromVisibleProducts);
      return;
    }

    const fromLocalProducts = this.localProductsState().find((product) => product.id === selectedId) ?? null;
    this.selectedProductState.set(fromLocalProducts ?? this.productsState()[0] ?? null);
  }

  private buildLoadFallbackMessage(viewMode: ProductsViewMode): string {
    switch (viewMode) {
      case 'rent':
        return 'Khong lay duoc API san pham cho thue. Hien thi du lieu noi bo.';
      case 'sell':
        return 'Khong lay duoc API san pham ban. Hien thi du lieu noi bo.';
      default:
        return 'Khong lay duoc API san pham. Hien thi du lieu noi bo.';
    }
  }
}

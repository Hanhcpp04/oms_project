import { Routes } from '@angular/router';
import { ProductDetailPageComponent } from './pages/product-detail-page.component';
import { ProductsPageComponent } from './pages/products-page.component';

export const PRODUCTS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'all'
  },
  {
    path: 'create',
    loadComponent: () => import('./create-product-page/create-product-page.component').then(c => c.CreateProductPageComponent),
    data: { breadcrumb: 'Thêm sản phẩm' }
  },
  {
    path: 'all',
    component: ProductsPageComponent,
    data: { productView: 'all', breadcrumb: 'Tất cả sản phẩm' }
  },
  {
    path: 'rent',
    component: ProductsPageComponent,
    data: { productView: 'rent', breadcrumb: 'Sản phẩm cho thuê' }
  },
  {
    path: 'sell',
    component: ProductsPageComponent,
    data: { productView: 'sell', breadcrumb: 'Sản phẩm bán' }
  },
  {
    path: ':productId',
    component: ProductDetailPageComponent,
    data: { breadcrumb: 'Chi tiết sản phẩm' }
  },
  {
    path: ':productId/qr-history',
    loadComponent: () => import('./pages/product-qr-history-page.component').then(c => c.ProductQrHistoryPageComponent),
    data: { breadcrumb: 'Lịch sử QR Thanh toán' }
  }
];

import { Routes } from '@angular/router';
import { ShopSettingsPageComponent } from './pages/shop-settings-page.component';
import { ProductFormConfigPageComponent } from './pages/product-form-config-page.component';
import { roleGuard } from '../../core/guards/role.guard';

export const SHOP_SETTINGS_ROUTES: Routes = [
  {
    path: '',
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'profile'
      },
      {
        path: 'profile',
        component: ShopSettingsPageComponent,
        data: { settingView: 'profile', breadcrumb: 'Hồ sơ shop' }
      },
      {
        path: 'category',
        component: ShopSettingsPageComponent,
        data: { settingView: 'category', breadcrumb: 'Danh mục shop' }
      },
      {
        path: 'staff',
        component: ShopSettingsPageComponent,
        data: { settingView: 'staff', breadcrumb: 'Nhân sự' }
      },
      {
        path: 'permissions',
        canActivate: [roleGuard],
        loadComponent: () =>
          import('./pages/permission-management-page.component').then((m) => m.PermissionManagementPageComponent),
        data: { breadcrumb: 'Phân quyền', allowedRoles: ['SHOP_OWNER'] }
      },
      {
        path: 'business-type',
        component: ShopSettingsPageComponent,
        data: { settingView: 'business-type', breadcrumb: 'Loại hình kinh doanh' }
      },
      {
        path: 'product-form',
        canActivate: [roleGuard],
        component: ProductFormConfigPageComponent,
        data: { breadcrumb: 'Cấu hình form sản phẩm', allowedRoles: ['SHOP_OWNER'] }
      },
      {
        path: 'shipping-methods',
        canActivate: [roleGuard],
        loadComponent: () =>
          import('./pages/shipping-method-management-page.component').then((m) => m.ShippingMethodManagementPageComponent),
        data: { breadcrumb: 'Phương thức vận chuyển', allowedRoles: ['SHOP_OWNER'] }
      },
      {
        path: 'order-sources',
        canActivate: [roleGuard],
        loadComponent: () =>
          import('./pages/order-source-management-page.component').then((m) => m.OrderSourceManagementPageComponent),
        data: { breadcrumb: 'Nguồn đơn hàng', allowedRoles: ['SHOP_OWNER'] }
      },
      {
        path: 'payment-config',
        canActivate: [roleGuard],
        loadComponent: () =>
          import('./pages/payment-config-page.component').then((m) => m.PaymentConfigPageComponent),
        data: { breadcrumb: 'Cấu hình thanh toán', allowedRoles: ['SHOP_OWNER'] }
      }
    ]
  }
];

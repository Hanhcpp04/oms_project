import { Routes } from '@angular/router';
import { EntryComponent } from './entry.component';
import { roleGuard } from '../core/guards/role.guard';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

export const ENTRY_ROUTES: Routes = [
  {
    path: '',
    component: EntryComponent,
    children: [
      {
        path: '',
        component: MainLayoutComponent,
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () =>
              import('../features/dashboard/pages/welcome-page.component').then((m) => m.WelcomePageComponent)
          },
          {
            path: 'dashboard',
            data: { breadcrumb: 'Dashboard' },
            loadChildren: () =>
              import('../features/dashboard/dashboard.routes').then((m) => m.DASHBOARD_ROUTES)
          },
          {
            path: 'unauthorized',
            data: { breadcrumb: 'Không có quyền truy cập' },
            loadComponent: () => import('../features/dashboard/pages/unauthorized-page.component').then((m) => m.UnauthorizedPageComponent)
          },
          {
            path: 'orders',
            canActivate: [roleGuard],
            data: { breadcrumb: 'Đơn hàng', allowedRoles: ['SHOP_OWNER', 'STAFF'] },
            loadChildren: () => import('../features/orders/orders.routes').then((m) => m.ORDERS_ROUTES)
          },
          {
            path: 'products',
            data: { breadcrumb: 'Sản phẩm' },
            loadChildren: () =>
              import('../features/products/products.routes').then((m) => m.PRODUCTS_ROUTES)
          },
          {
            path: 'users',
            pathMatch: 'full',
            redirectTo: 'employees'
          },
          {
            path: 'employees',
            canActivate: [roleGuard],
            data: { breadcrumb: 'Nhân viên', allowedRoles: ['SHOP_OWNER'] },
            loadChildren: () => import('../features/users/users.routes').then((m) => m.USERS_ROUTES)
          },
          {
            path: 'form-config',
            canActivate: [roleGuard],
            data: { breadcrumb: 'Cấu hình form đơn hàng', allowedRoles: ['SHOP_OWNER'] },
            loadChildren: () =>
              import('../features/form-config/form-config.routes').then((m) => m.FORM_CONFIG_ROUTES)
          },
          {
            path: 'shop-settings',
            data: { breadcrumb: 'Thiết lập shop' },
            loadChildren: () =>
              import('../features/shop-settings/shop-settings.routes').then((m) => m.SHOP_SETTINGS_ROUTES)
          }
        ]
      }
    ]
  }
];

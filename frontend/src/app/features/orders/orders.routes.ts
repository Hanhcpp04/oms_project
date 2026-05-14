import { Routes } from '@angular/router';
import { OrderDetailPageComponent } from './pages/order-detail-page.component';
import { OrdersPageComponent } from './pages/orders-page.component';

export const ORDERS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'all'
  },
  {
    path: 'all',
    component: OrdersPageComponent,
    data: { orderType: 'ALL', breadcrumb: 'Tất cả' }
  },
  {
    path: 'rent',
    component: OrdersPageComponent,
    data: { orderType: 'RENT', breadcrumb: 'Đơn cho thuê' }
  },
  {
    path: 'sell',
    component: OrdersPageComponent,
    data: { orderType: 'SELL', breadcrumb: 'Đơn bán' }
  },
  {
    path: ':orderId',
    component: OrderDetailPageComponent,
    data: { breadcrumb: 'Chi tiết đơn hàng' }
  }
];
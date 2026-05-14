import { Routes } from '@angular/router';
import { FormDashboardPageComponent } from './pages/form-dashboard-page.component';
import { FormConfigPageComponent } from './pages/form-config-page.component';
import { OrderFormConfigPageComponent } from './pages/order-form-config-page.component';

export const FORM_CONFIG_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: OrderFormConfigPageComponent,
    data: { breadcrumb: 'Cấu hình biểu mẫu' }
  },
  {
    path: 'rent',
    component: OrderFormConfigPageComponent,
    data: { category: 'rent', breadcrumb: 'Cấu hình form cho thuê' }
  },
  {
    path: 'sell',
    component: OrderFormConfigPageComponent,
    data: { category: 'sell', breadcrumb: 'Cấu hình form bán' }
  },
  {
    path: 'dashboard/rent',
    component: FormDashboardPageComponent,
    data: { category: 'rent', breadcrumb: 'Quản lý biểu mẫu thuê' }
  },
  {
    path: 'dashboard/sell',
    component: FormDashboardPageComponent,
    data: { category: 'sell', breadcrumb: 'Quản lý biểu mẫu bán' }
  },
  {
    path: 'edit/:id',
    component: FormConfigPageComponent,
    data: { breadcrumb: 'Chỉnh sửa biểu mẫu' }
  }
];

import { Routes } from '@angular/router';
import { PublicShellComponent } from './layout/public-shell.component';
import { LandingPageComponent } from './pages/landing-page.component';
import { LoginPageComponent } from './pages/login-page.component';
import { PublicFormPageComponent } from './pages/public-form-page.component';
import { RegisterPageComponent } from './pages/register-page.component';

export const PUBLIC_ROUTES: Routes = [
  {
    path: '',
    component: PublicShellComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: LandingPageComponent
      },
      {
        path: 'login',
        component: LoginPageComponent
      },
      {
        path: 'register',
        component: RegisterPageComponent
      },
      {
        path: 'forms/:templateId',
        component: PublicFormPageComponent,
        data: { breadcrumb: 'Bieu mau cong khai' }
      },
      {
        path: 'track-order/:token',
        loadComponent: () =>
          import('./pages/order-tracking-page.component').then((m) => m.OrderTrackingPageComponent),
        data: { breadcrumb: 'Theo doi don hang' }
      }
    ]
  }
];

import { Routes } from '@angular/router';
import { authRequiredGuard } from './core/guards/auth-required.guard';
import { changePasswordRequiredGuard } from './core/guards/change-password-required.guard';
import { shopSetupCompletedGuard } from './core/guards/shop-setup-completed.guard';
import { shopSetupRequiredGuard } from './core/guards/shop-setup-required.guard';
import { onboardingStepGuard } from './core/guards/onboarding-step.guard';

export const routes: Routes = [
	{
		path: 'change-password',
		canActivate: [authRequiredGuard, changePasswordRequiredGuard],
		loadComponent: () =>
			import('./features/public/pages/change-password-page.component').then((m) => m.ChangePasswordPageComponent)
	},
	{
		path: 'shop-setup',
		canActivate: [authRequiredGuard, shopSetupRequiredGuard],
		loadComponent: () =>
			import('./features/onboarding/layouts/shop-onboarding-layout.component').then((m) => m.ShopOnboardingLayoutComponent),
		children: [
			{
				path: '',
				pathMatch: 'full',
				loadComponent: () =>
					import('./features/onboarding/pages/shop-onboarding-page.component').then((m) => m.ShopOnboardingPageComponent)
			},
			{
				path: 'profile',
				canActivate: [onboardingStepGuard],
				loadComponent: () =>
					import('./features/shop-settings/pages/shop-settings-page.component').then((m) => m.ShopSettingsPageComponent),
				data: { settingView: 'profile', onboardingFlow: true, breadcrumb: 'Bước 1: Hồ sơ shop' }
			},
			{
				path: 'business-type',
				canActivate: [onboardingStepGuard],
				loadComponent: () =>
					import('./features/shop-settings/pages/shop-settings-page.component').then((m) => m.ShopSettingsPageComponent),
				data: { settingView: 'business-type', onboardingFlow: true, breadcrumb: 'Bước 2: Mô hình kinh doanh' }
			},
			{
				path: 'category',
				canActivate: [onboardingStepGuard],
				loadComponent: () =>
					import('./features/shop-settings/pages/shop-settings-page.component').then((m) => m.ShopSettingsPageComponent),
				data: { settingView: 'category', onboardingFlow: true, breadcrumb: 'Bước 3: Danh mục shop' }
			}
		]
	},
	{
		path: 'app',
		canActivate: [authRequiredGuard, shopSetupCompletedGuard],
		loadChildren: () => import('./remote-entry/entry.routes').then((m) => m.ENTRY_ROUTES)
	},
	{
		path: 'f/:shopSlug',
		loadComponent: () => import('./features/public-order-form/pages/public-order-form-page.component').then(m => m.PublicOrderFormPageComponent)
	},
	{
		path: '',
		loadChildren: () => import('./features/public/public.routes').then((m) => m.PUBLIC_ROUTES)
	},
	{
		path: '**',
		redirectTo: ''
	}
];

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../auth/auth.store';

const STEP_ORDER: Record<string, number> = {
  'SHOP_PROFILE': 0,
  'BUSINESS_TYPE': 1,
  'CATEGORY': 2,
  'COMPLETED': 3
};

const ROUTE_TO_STEP: Record<string, string> = {
  'profile': 'SHOP_PROFILE',
  'business-type': 'BUSINESS_TYPE',
  'category': 'CATEGORY'
};

const STEP_TO_ROUTE: Record<string, string> = {
  'SHOP_PROFILE': 'profile',
  'BUSINESS_TYPE': 'business-type',
  'CATEGORY': 'category'
};

export const onboardingStepGuard: CanActivateFn = (route) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  const onboarding = authStore.onboarding();
  const targetRoute = route.url[0]?.path ?? '';

  if (!authStore.currentShop()) {
    return targetRoute && targetRoute !== 'profile'
      ? router.createUrlTree(['/shop-setup', 'profile'])
      : true;
  }

  if (!onboarding) {
    return targetRoute && targetRoute !== 'profile'
      ? router.createUrlTree(['/shop-setup', 'profile'])
      : true;
  }

  const currentStep = onboarding.currentStep || 'SHOP_PROFILE';
  const targetStep = ROUTE_TO_STEP[targetRoute];

  if (!targetStep) {
    return true;
  }

  const currentIndex = STEP_ORDER[currentStep] ?? 0;
  const targetIndex = STEP_ORDER[targetStep] ?? 0;

  // Only allow navigating to the current step (or completed steps behind it)
  // Block both backward navigation to completed steps AND forward skipping
  if (targetIndex !== currentIndex) {
    const correctRoute = STEP_TO_ROUTE[currentStep];
    if (correctRoute) {
        return router.createUrlTree(['/shop-setup', correctRoute]);
    }
    // If completed, redirect to app
    if (currentStep === 'COMPLETED' || onboarding.completed) {
        return router.createUrlTree(['/app']);
    }
  }

  return true;
};

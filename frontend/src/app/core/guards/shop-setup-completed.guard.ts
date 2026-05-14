import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../auth/auth.store';

export const shopSetupCompletedGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);

  if (!authStore.needsShopCreation()) {
    return true;
  }

  const router = inject(Router);
  return router.createUrlTree(['/shop-setup']);
};

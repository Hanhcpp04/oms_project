import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../auth/auth.store';

export const shopSetupRequiredGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);

  if (authStore.needsShopSetup()) {
    return true;
  }

  const router = inject(Router);
  return router.createUrlTree(['/app']);
};

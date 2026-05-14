import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../auth/auth.store';

export const changePasswordRequiredGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);

  if (authStore.needsPasswordChange()) {
    return true;
  }

  const router = inject(Router);
  return router.createUrlTree(['/app']);
};

import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthTokenService } from '../services/auth-token.service';

export const authRequiredGuard: CanActivateFn = (_route, state) => {
  const authTokenService = inject(AuthTokenService);

  if (authTokenService.getAccessToken()) {
    return true;
  }

  const router = inject(Router);
  return router.createUrlTree(['/login'], {
    queryParams: {
      redirect: state.url
    }
  });
};

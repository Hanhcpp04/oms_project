import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppRole } from '../auth/auth.models';
import { AuthStore } from '../auth/auth.store';

/**
 * Route guard that checks if the current user has one of the allowed roles.
 *
 * Usage in route config:
 * ```
 * {
 *   path: 'employees',
 *   canActivate: [roleGuard],
 *   data: { allowedRoles: ['SHOP_OWNER'] },
 *   loadChildren: () => ...
 * }
 * ```
 *
 * If no `allowedRoles` are specified in route data, access is granted.
 */
export const roleGuard: CanActivateFn = (route) => {
    const allowedRoles = route.data['allowedRoles'] as AppRole[] | undefined;

    // No role restriction configured — allow access
    if (!allowedRoles || allowedRoles.length === 0) {
        return true;
    }

    const authStore = inject(AuthStore);

    if (authStore.hasAnyRole(allowedRoles)) {
        return true;
    }

    const router = inject(Router);
    return router.createUrlTree(['/app/unauthorized']);
};

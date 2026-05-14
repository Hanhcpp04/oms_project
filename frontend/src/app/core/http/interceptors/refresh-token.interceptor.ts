import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthApiService } from '../../auth/auth-api.service';
import { AuthTokenService } from '../../services/auth-token.service';

/**
 * Tracks whether a token refresh is currently in progress.
 * Queues concurrent 401-failing requests and retries them after refresh completes.
 */
let isRefreshing = false;
const refreshSubject = new BehaviorSubject<string | null>(null);

/**
 * Interceptor that automatically refreshes the access token on 401 responses.
 *
 * When a request fails with 401:
 *  1. If no refresh is in progress, initiate a refresh and retry the original request.
 *  2. If a refresh IS in progress, queue the request and retry after the refresh completes.
 *  3. If the refresh itself fails, clear tokens and redirect to login.
 *
 * Requests to the refresh endpoint itself are excluded to avoid infinite loops.
 */
export const refreshTokenInterceptor: HttpInterceptorFn = (request, next) => {
  return next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      // Don't try to refresh if the failing request IS the refresh endpoint
      if (request.url.includes('/auth/refresh') || request.url.includes('/auth/login')) {
        return throwError(() => error);
      }

      const authTokenService = inject(AuthTokenService);
      const authApiService = inject(AuthApiService);
      const router = inject(Router);
      const refreshToken = authTokenService.getRefreshToken();

      // No refresh token available — nothing to retry with
      if (!refreshToken) {
        authTokenService.clearTokens();
        void router.navigate(['/login']);
        return throwError(() => error);
      }

      if (!isRefreshing) {
        isRefreshing = true;
        refreshSubject.next(null);

        return authApiService.refresh(refreshToken).pipe(
          switchMap((session) => {
            isRefreshing = false;
            const newAccessToken = session.accessToken!;
            authTokenService.setTokens(newAccessToken, session.refreshToken);
            refreshSubject.next(newAccessToken);

            // Retry the original request with the new token
            return next(
              request.clone({
                setHeaders: { Authorization: `Bearer ${newAccessToken}` }
              })
            );
          }),
          catchError((refreshError) => {
            isRefreshing = false;
            refreshSubject.next(null);
            authTokenService.clearTokens();
            void router.navigate(['/login']);
            return throwError(() => refreshError);
          })
        );
      }

      // A refresh is already in progress — wait for it to complete
      return refreshSubject.pipe(
        filter((token) => token !== null),
        take(1),
        switchMap((newToken) =>
          next(
            request.clone({
              setHeaders: { Authorization: `Bearer ${newToken}` }
            })
          )
        )
      );
    })
  );
};

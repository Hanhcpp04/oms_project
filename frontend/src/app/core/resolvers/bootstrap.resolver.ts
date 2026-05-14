import { ResolveFn } from '@angular/router';
import { inject } from '@angular/core';
import { AuthStore } from '../auth/auth.store';

export const bootstrapResolver: ResolveFn<boolean> = () => {
  const authStore = inject(AuthStore);
  authStore.loadCurrentUser();
  return true;
};
import { HttpContextToken } from '@angular/common/http';
import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface ApiConfig {
  baseUrl: string;
  timeoutMs: number;
  googleClientId: string;
}

const googleClientId = environment.googleClientId;

export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG');

export const DEFAULT_API_CONFIG: ApiConfig = {
  baseUrl: '/api',
  timeoutMs: 30000,
  googleClientId
};

export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, timeout } from 'rxjs';
import { API_CONFIG } from './api.config';

export type QueryValue = string | number | boolean | null | undefined;

interface RequestOptions {
  context?: HttpContext;
  params?: object;
}

@Injectable({ providedIn: 'root' })
export class HttpService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(API_CONFIG);

  get<T>(endpoint: string, options?: RequestOptions): Observable<T> {
    return this.http
      .get<T>(this.buildUrl(endpoint), {
        context: options?.context,
        params: this.buildParams(options?.params)
      })
      .pipe(timeout(this.apiConfig.timeoutMs));
  }

  post<T, TBody>(endpoint: string, body: TBody, options?: RequestOptions): Observable<T> {
    return this.http
      .post<T>(this.buildUrl(endpoint), body, {
        context: options?.context,
        params: this.buildParams(options?.params)
      })
      .pipe(timeout(this.apiConfig.timeoutMs));
  }

  put<T, TBody>(endpoint: string, body: TBody, options?: RequestOptions): Observable<T> {
    return this.http
      .put<T>(this.buildUrl(endpoint), body, {
        context: options?.context,
        params: this.buildParams(options?.params)
      })
      .pipe(timeout(this.apiConfig.timeoutMs));
  }

  delete<T>(endpoint: string, options?: RequestOptions): Observable<T> {
    return this.http
      .delete<T>(this.buildUrl(endpoint), {
        context: options?.context,
        params: this.buildParams(options?.params)
      })
      .pipe(timeout(this.apiConfig.timeoutMs));
  }

  patch<T, TBody = any>(endpoint: string, body?: TBody, options?: RequestOptions): Observable<T> {
    return this.http
      .patch<T>(this.buildUrl(endpoint), body, {
        context: options?.context,
        params: this.buildParams(options?.params)
      })
      .pipe(timeout(this.apiConfig.timeoutMs));
  }

  private buildUrl(endpoint: string): string {
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint;
    }

    const baseUrl = this.apiConfig.baseUrl.replace(/\/+$/, '');
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    return `${baseUrl}${normalizedEndpoint}`;
  }

  private buildParams(params?: object): HttpParams {
    let httpParams = new HttpParams();

    if (!params) {
      return httpParams;
    }

    Object.entries(params).forEach(([key, rawValue]) => {
      const value = rawValue as QueryValue;

      if (value === null || value === undefined || value === '') {
        return;
      }

      httpParams = httpParams.set(key, String(value));
    });

    return httpParams;
  }
}
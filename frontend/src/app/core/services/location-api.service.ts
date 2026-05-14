import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { SKIP_AUTH } from '../http/api.config';

export interface Province {
  code: number;
  name: string;
  division_type?: string;
  codename?: string;
  phone_code?: number;
}

export interface District {
  code: number;
  name: string;
  division_type?: string;
  codename?: string;
  province_code?: number;
}

export interface Ward {
  code: number;
  name: string;
  division_type?: string;
  codename?: string;
  district_code?: number;
}

@Injectable({
  providedIn: 'root'
})
export class LocationApiService {
  private readonly http = inject(HttpClient);

  // External provinces API v1 — proxied through dev server to bypass CORS
  // Proxy config maps /api/v1/* → https://provinces.open-api.vn/api/v1/*
  private readonly apiUrl = '/api/v1';

  private readonly skipAuthContext = new HttpContext().set(SKIP_AUTH, true);

  // Cache provinces locally to avoid repeated requests
  private provincesCache: Province[] | null = null;

  getProvinces(): Observable<Province[]> {
    // Return cached data if available
    if (this.provincesCache) {
      return of(this.provincesCache);
    }

    // Load from static bundled JSON file to completely avoid CORS issues
    return this.http.get<Province[]>('provinces.json').pipe(
      tap(data => this.provincesCache = data),
      catchError(() => {
        // Fallback: try proxy API
        return this.http.get<Province[]>(`${this.apiUrl}/p`, {
          context: this.skipAuthContext
        }).pipe(
          tap(data => this.provincesCache = data),
          catchError(err => {
            console.error('Failed to load provinces:', err);
            return of([]);
          })
        );
      })
    );
  }

  getDistricts(provinceCode: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/p/${provinceCode}?depth=2`, {
      context: this.skipAuthContext
    }).pipe(
      catchError(err => {
        console.error('Failed to load districts:', err);
        return of({ districts: [] });
      })
    );
  }

  getWards(districtCode: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/d/${districtCode}?depth=2`, {
      context: this.skipAuthContext
    }).pipe(
      catchError(err => {
        console.error('Failed to load wards:', err);
        return of({ wards: [] });
      })
    );
  }
}

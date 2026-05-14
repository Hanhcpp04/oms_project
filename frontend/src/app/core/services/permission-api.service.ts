import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { HttpService } from '../http/http.service';

export interface PermissionItem {
  id: number;
  code: string;
  name: string;
  category: string;
  description: string;
  granted?: boolean;
}

interface ApiEnvelope<T> {
  data?: T;
}

@Injectable({ providedIn: 'root' })
export class PermissionApiService {
  private readonly httpService = inject(HttpService);

  /** Get all available permissions in the system */
  getAllPermissions(): Observable<PermissionItem[]> {
    return this.httpService
      .get<ApiEnvelope<PermissionItem[]>>('/permissions')
      .pipe(map((response) => response.data ?? []));
  }

  /** Get permissions for a specific staff member (with granted status) */
  getStaffPermissions(staffId: number): Observable<PermissionItem[]> {
    return this.httpService
      .get<ApiEnvelope<PermissionItem[]>>(`/staff/${staffId}/permissions`)
      .pipe(map((response) => response.data ?? []));
  }

  /** Update all permissions for a staff member */
  updateStaffPermissions(staffId: number, permissionCodes: string[]): Observable<string[]> {
    return this.httpService
      .put<ApiEnvelope<string[]>, { permissionCodes: string[] }>(`/staff/${staffId}/permissions`, { permissionCodes })
      .pipe(map((response) => response.data ?? []));
  }
}

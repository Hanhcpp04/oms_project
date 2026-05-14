import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { HttpService } from '../http/http.service';

export interface CreateStaffPayload {
  fullName: string;
  email?: string;
  phone?: string;
}

export interface StaffResponse {
  id: number;
  fullName: string;
  email: string;
  username: string;
  phone?: string | null;
  temporaryPassword?: string;
}

interface ApiEnvelope<T> {
  data?: T;
}

@Injectable({ providedIn: 'root' })
export class StaffApiService {
  private readonly httpService = inject(HttpService);

  createStaff(payload: CreateStaffPayload): Observable<StaffResponse> {
    return this.httpService
      .post<ApiEnvelope<StaffResponse>, CreateStaffPayload>('/staff', payload)
      .pipe(map((response) => response.data!));
  }
}

import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { HttpService } from '../../../core/http/http.service';

export interface CreateWorkShiftPayload {
  shiftDate: string;
  startTime: string;
  endTime: string;
  name?: string;
  staffIds: string[];
}

export interface UpdateWorkShiftPayload {
  shiftDate: string;
  startTime: string;
  endTime: string;
  name?: string;
  staffIds: string[];
}

export interface ShiftStaffDto {
  id: string;
  fullName: string;
  username: string;
  email: string;
}

export interface WorkShiftResponse {
  id: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  name?: string;
  assignedStaff: ShiftStaffDto[];
}

interface ApiEnvelope<T> {
  data?: T;
  message?: string;
  success?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ShiftApiService {
  private readonly httpService = inject(HttpService);
  private readonly endpoint = '/staff/shifts';

  createShift(payload: CreateWorkShiftPayload): Observable<WorkShiftResponse> {
    return this.httpService
      .post<ApiEnvelope<WorkShiftResponse>, CreateWorkShiftPayload>(this.endpoint, payload)
      .pipe(map((response) => response.data!));
  }

  updateShift(shiftId: string, payload: UpdateWorkShiftPayload): Observable<WorkShiftResponse> {
    return this.httpService
      .put<ApiEnvelope<WorkShiftResponse>, UpdateWorkShiftPayload>(`${this.endpoint}/${shiftId}`, payload)
      .pipe(map((response) => response.data!));
  }

  deleteShift(shiftId: string): Observable<void> {
    return this.httpService
      .delete<ApiEnvelope<void>>(`${this.endpoint}/${shiftId}`)
      .pipe(map(() => void 0));
  }

  getShiftsByDateRange(startDate: string, endDate: string): Observable<WorkShiftResponse[]> {
    return this.httpService
      .get<ApiEnvelope<WorkShiftResponse[]>>(this.endpoint, {
        params: { startDate, endDate }
      })
      .pipe(map((response) => response.data!));
  }
}

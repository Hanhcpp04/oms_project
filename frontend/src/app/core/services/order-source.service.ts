import { Injectable, inject } from '@angular/core';
import { HttpService } from '../http/http.service';
import { map } from 'rxjs';
import { ApiEnvelope, unwrapApiResponse } from '../utils/api-response.util';

export interface OrderSourceDto {
  id: number;
  name: string;
  active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class OrderSourceService {
  private readonly http = inject(HttpService);
  private readonly BASE_URL = '/shops/order-sources';

  getAllSources() {
    return this.http.get<ApiEnvelope<OrderSourceDto[]>>(this.BASE_URL).pipe(
      map(unwrapApiResponse)
    );
  }

  getActiveSources() {
    return this.http.get<ApiEnvelope<OrderSourceDto[]>>(`${this.BASE_URL}/active`).pipe(
      map(unwrapApiResponse)
    );
  }

  createSource(data: Partial<OrderSourceDto>) {
    return this.http.post<any, any>(this.BASE_URL, data).pipe(
      map(unwrapApiResponse)
    );
  }

  updateSource(id: number, data: Partial<OrderSourceDto>) {
    return this.http.put<any, any>(`${this.BASE_URL}/${id}`, data).pipe(
      map(unwrapApiResponse)
    );
  }

  deleteSource(id: number) {
    return this.http.delete<any>(`${this.BASE_URL}/${id}`).pipe(
      map(unwrapApiResponse)
    );
  }
}

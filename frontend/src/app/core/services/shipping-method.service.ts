import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HttpService } from '../http/http.service';
import { unwrapApiResponse } from '../utils/api-response.util';

export type FeePolicy = 'FREESHIP' | 'CUSTOMER_PAYS_SHIPPER' | 'FIXED_FEE';

export interface ShippingMethodDto {
  id?: number;
  name: string;
  feePolicy: FeePolicy;
  defaultFee?: number;
  active: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ShippingMethodService {
  private readonly http = inject(HttpService);
  private readonly BASE_URL = '/shops/shipping-methods';

  getAllMethods(): Observable<ShippingMethodDto[]> {
    return this.http.get<any>(this.BASE_URL).pipe(
      map(response => unwrapApiResponse(response))
    );
  }

  createMethod(data: ShippingMethodDto): Observable<ShippingMethodDto> {
    return this.http.post<any, any>(this.BASE_URL, data).pipe(
      map(response => unwrapApiResponse(response))
    );
  }

  updateMethod(id: number, data: ShippingMethodDto): Observable<ShippingMethodDto> {
    return this.http.put<any, any>(`${this.BASE_URL}/${id}`, data).pipe(
      map(response => unwrapApiResponse(response))
    );
  }

  deleteMethod(id: number): Observable<void> {
    return this.http.delete<any>(`${this.BASE_URL}/${id}`).pipe(
      map(response => unwrapApiResponse(response))
    );
  }
}

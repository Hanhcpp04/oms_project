import { Injectable, inject } from '@angular/core';
import { HttpService } from '../../../core/http/http.service';
import { map, Observable } from 'rxjs';

interface ApiEnvelope<T> {
  data?: T;
}

export interface CreateAddressRequest {
  label: string;
  addressLine: string;
  ward: string;
  district: string;
  province: string;
  isDefault?: boolean;
}

export interface UpdateAddressRequest {
  label: string;
  addressLine: string;
  ward: string;
  district: string;
  province: string;
  isDefault?: boolean;
}

export interface AddressFormData {
  label: string;
  addressLine: string;
  ward: string;
  district: string;
  province: string;
  isDefault: boolean;
}

export interface ShopAddressResponse {
  id: number;
  label: string;
  addressLine: string;
  ward: string;
  district: string;
  province: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class AddressApiService {
  private readonly httpService = inject(HttpService);

  /**
   * Get all addresses for the current shop
   */
  getAddresses(): Observable<ShopAddressResponse[]> {
    return this.httpService
      .get<ApiEnvelope<ShopAddressResponse[]>>('/shops/addresses')
      .pipe(map((response) => response.data || []));
  }

  /**
   * Create a new address
   */
  createAddress(request: CreateAddressRequest): Observable<ShopAddressResponse> {
    return this.httpService
      .post<ApiEnvelope<ShopAddressResponse>, CreateAddressRequest>('/shops/addresses', request)
      .pipe(map((response) => response.data as ShopAddressResponse));
  }

  /**
   * Update an existing address
   */
  updateAddress(id: number, request: UpdateAddressRequest): Observable<ShopAddressResponse> {
    return this.httpService
      .put<ApiEnvelope<ShopAddressResponse>, UpdateAddressRequest>(`/shops/addresses/${id}`, request)
      .pipe(map((response) => response.data as ShopAddressResponse));
  }

  /**
   * Delete an address
   */
  deleteAddress(id: number): Observable<void> {
    return this.httpService
      .delete<ApiEnvelope<void>>(`/shops/addresses/${id}`)
      .pipe(map(() => undefined));
  }

  /**
   * Set an address as default
   */
  setDefaultAddress(id: number): Observable<ShopAddressResponse> {
    return this.httpService
      .patch<ApiEnvelope<ShopAddressResponse>>(`/shops/addresses/${id}/default`, {})
      .pipe(map((response) => response.data as ShopAddressResponse));
  }
}

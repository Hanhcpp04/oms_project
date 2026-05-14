import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { HttpService } from '../http/http.service';
import { ApiEnvelope, unwrapApiResponse } from '../utils/api-response.util';

export interface RentalAvailabilityBlock {
  id: number;
  productId: number;
  variantId: number;
  orderId?: number;
  orderCode?: string;
  startDate: string;
  endDate: string;
  blockType: 'CONFIRMED' | 'MANUAL';
  reason?: string;
}

export interface RentalAvailabilityQuery {
  productId: string | number;
  variantId?: string | number | null;
  from?: string;
  to?: string;
}

@Injectable({ providedIn: 'root' })
export class RentalAvailabilityApiService {
  private readonly http = inject(HttpService);

  getAvailability(query: RentalAvailabilityQuery): Observable<RentalAvailabilityBlock[]> {
    return this.http
      .get<RentalAvailabilityBlock[] | ApiEnvelope<RentalAvailabilityBlock[]>>('/rental/availability', {
        params: {
          productId: query.productId,
          variantId: query.variantId || undefined,
          from: query.from,
          to: query.to
        }
      })
      .pipe(map((response) => unwrapApiResponse(response) ?? []));
  }

  getPublicAvailability(
    shopSlug: string,
    query: RentalAvailabilityQuery
  ): Observable<RentalAvailabilityBlock[]> {
    return this.http
      .get<RentalAvailabilityBlock[] | ApiEnvelope<RentalAvailabilityBlock[]>>(
        `/public/shops/${shopSlug}/products/${query.productId}/availability`,
        {
          params: {
            variantId: query.variantId || undefined,
            from: query.from,
            to: query.to
          }
        }
      )
      .pipe(map((response) => unwrapApiResponse(response) ?? []));
  }
}

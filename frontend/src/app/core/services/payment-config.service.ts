import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HttpService } from '../http/http.service';
import { unwrapApiResponse } from '../utils/api-response.util';

export interface PaymentConfigDto {
  codEnabled: boolean;
  bankTransferEnabled: boolean;
  bankName?: string;
  bankCode?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  vnpayEnabled: boolean;
  vnpayTmnCode?: string;
  vnpayHashSecret?: string;
}

/** Public-facing subset — no secrets */
export interface PublicPaymentConfig {
  codEnabled: boolean;
  bankTransferEnabled: boolean;
  bankName?: string;
  bankCode?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  vnpayEnabled: boolean;
}

@Injectable({ providedIn: 'root' })
export class PaymentConfigService {
  private readonly http = inject(HttpService);
  private readonly BASE_URL = '/shops/payment-config';

  getConfig(): Observable<PaymentConfigDto> {
    return this.http.get<any>(this.BASE_URL).pipe(
      map(response => unwrapApiResponse(response))
    );
  }

  getAvailableConfig(): Observable<PublicPaymentConfig> {
    return this.http.get<any>(`${this.BASE_URL}/available`).pipe(
      map(response => unwrapApiResponse(response))
    );
  }

  saveConfig(data: PaymentConfigDto): Observable<PaymentConfigDto> {
    return this.http.put<any, any>(this.BASE_URL, data).pipe(
      map(response => unwrapApiResponse(response))
    );
  }
}

/** Known Vietnamese banks for the dropdown */
export const VIETNAMESE_BANKS = [
  { code: 'VCB',  name: 'Vietcombank' },
  { code: 'TCB',  name: 'Techcombank' },
  { code: 'MB',   name: 'MBBank' },
  { code: 'ACB',  name: 'ACB' },
  { code: 'VPB',  name: 'VPBank' },
  { code: 'TPB',  name: 'TPBank' },
  { code: 'VIB',  name: 'VIB' },
  { code: 'SHB',  name: 'SHB' },
  { code: 'HDB',  name: 'HDBank' },
  { code: 'OCB',  name: 'OCB' },
  { code: 'BIDV', name: 'BIDV' },
  { code: 'CTG',  name: 'VietinBank' },
  { code: 'AGR',  name: 'Agribank' },
  { code: 'STB',  name: 'Sacombank' },
  { code: 'EIB',  name: 'Eximbank' },
  { code: 'MSB',  name: 'MSB' },
  { code: 'NAB',  name: 'Nam A Bank' },
  { code: 'PGB',  name: 'PG Bank' },
  { code: 'BAB',  name: 'Bac A Bank' },
  { code: 'SEAB', name: 'SeABank' },
];

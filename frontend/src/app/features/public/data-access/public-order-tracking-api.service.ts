import { HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { SKIP_AUTH } from '../../../core/http/api.config';
import { HttpService } from '../../../core/http/http.service';
import {
  ApiEnvelope,
  asNumber,
  asOptionalString,
  unwrapApiResponse
} from '../../../core/utils/api-response.util';
import {
  PublicOrderTrackingItem,
  PublicOrderTrackingOrder,
  PublicOrderTrackingPayment
} from './public-order-tracking.model';

interface PublicOrderTrackingApi {
  orderCode?: string;
  orderType?: string;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  shopName?: string;
  shopLogoUrl?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerNote?: string;
  shippingMethod?: string;
  shippingFee?: number;
  totalAmount?: number;
  depositAmount?: number;
  rentFrom?: string;
  rentTo?: string;
  createdAt?: string;
  updatedAt?: string;
  items?: PublicOrderTrackingItemApi[];
  payment?: PublicOrderTrackingPaymentApi;
}

interface PublicOrderTrackingPaymentApi {
  paymentId?: number;
  provider?: string;
  method?: string;
  purpose?: string;
  status?: string;
  providerOrderCode?: number;
  providerPaymentLinkId?: string;
  amount?: number;
  currency?: string;
  description?: string;
  checkoutUrl?: string;
  qrCode?: string;
  qrImageUrl?: string;
}

interface PublicOrderTrackingItemApi {
  productName?: string;
  productImageUrl?: string;
  sku?: string;
  size?: string;
  color?: string;
  quantity?: number;
  unitPrice?: number;
  lineTotal?: number;
}

@Injectable({ providedIn: 'root' })
export class PublicOrderTrackingApiService {
  private readonly httpService = inject(HttpService);

  getByToken(token: string): Observable<PublicOrderTrackingOrder> {
    return this.httpService
      .get<PublicOrderTrackingApi | ApiEnvelope<PublicOrderTrackingApi>>(
        `/public/orders/track/${encodeURIComponent(token)}`,
        { context: new HttpContext().set(SKIP_AUTH, true) }
      )
      .pipe(
        map((response) => unwrapApiResponse(response)),
        map((response) => normalizeTrackingOrder(response))
      );
  }
}

function normalizeTrackingOrder(raw: PublicOrderTrackingApi): PublicOrderTrackingOrder {
  return {
    orderCode: raw.orderCode || '',
    orderType: raw.orderType === 'RENT' ? 'RENT' : 'SELL',
    status: (raw.status as PublicOrderTrackingOrder['status']) || 'PENDING',
    paymentStatus: raw.paymentStatus as PublicOrderTrackingOrder['paymentStatus'],
    paymentMethod: raw.paymentMethod as PublicOrderTrackingOrder['paymentMethod'],
    shopName: asOptionalString(raw.shopName),
    shopLogoUrl: asOptionalString(raw.shopLogoUrl),
    customerName: asOptionalString(raw.customerName),
    customerPhone: asOptionalString(raw.customerPhone),
    customerAddress: asOptionalString(raw.customerAddress),
    customerNote: asOptionalString(raw.customerNote),
    shippingMethod: asOptionalString(raw.shippingMethod),
    shippingFee: asNumber(raw.shippingFee, 0),
    totalAmount: asNumber(raw.totalAmount, 0),
    depositAmount: raw.depositAmount === undefined ? undefined : asNumber(raw.depositAmount, 0),
    rentFrom: asOptionalString(raw.rentFrom),
    rentTo: asOptionalString(raw.rentTo),
    createdAt: asOptionalString(raw.createdAt),
    updatedAt: asOptionalString(raw.updatedAt),
    items: (raw.items ?? []).map(normalizeTrackingItem),
    payment: raw.payment ? normalizeTrackingPayment(raw.payment) : undefined
  };
}

function normalizeTrackingItem(raw: PublicOrderTrackingItemApi): PublicOrderTrackingItem {
  return {
    productName: raw.productName || 'San pham',
    productImageUrl: asOptionalString(raw.productImageUrl),
    sku: asOptionalString(raw.sku),
    size: asOptionalString(raw.size),
    color: asOptionalString(raw.color),
    quantity: asNumber(raw.quantity, 1),
    unitPrice: asNumber(raw.unitPrice, 0),
    lineTotal: asNumber(raw.lineTotal, 0)
  };
}

function normalizeTrackingPayment(raw: PublicOrderTrackingPaymentApi): PublicOrderTrackingPayment {
  return {
    paymentId: raw.paymentId,
    provider: asOptionalString(raw.provider),
    method: asOptionalString(raw.method),
    purpose: asOptionalString(raw.purpose),
    status: asOptionalString(raw.status),
    providerOrderCode: raw.providerOrderCode,
    providerPaymentLinkId: asOptionalString(raw.providerPaymentLinkId),
    amount: raw.amount === undefined ? undefined : asNumber(raw.amount, 0),
    currency: asOptionalString(raw.currency),
    description: asOptionalString(raw.description),
    checkoutUrl: asOptionalString(raw.checkoutUrl),
    qrCode: asOptionalString(raw.qrCode),
    qrImageUrl: asOptionalString(raw.qrImageUrl)
  };
}

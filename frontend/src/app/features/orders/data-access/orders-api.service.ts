import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/app.constants';
import { HttpService } from '../../../core/http/http.service';
import { PageResponse } from '../../../core/models/pagination.model';
import {
  AutoOrderDraft,
  CreateOrderProductInput,
  Order,
  OrdersQuery,
  OrderType,
  CreateOrderInput,
  OrderStatus
} from './models/order.model';
import {
  asNumber,
  asString,
  asOptionalNumber,
  asOptionalString,
  isRecord,
  unwrapApiResponse
} from '../../../core/utils/api-response.util';

interface ApiEnvelope<T> {
  data?: T;
}

interface AutoCleanApiResponse {
  orderType?: unknown;
  type?: unknown;
  customerName?: unknown;
  customer_name?: unknown;
  customerPhone?: unknown;
  phone?: unknown;
  customerAddress?: unknown;
  address?: unknown;
  note?: unknown;
  customerNote?: unknown;
  sourceChannel?: unknown;
  shippingMethod?: unknown;
  shippingFee?: unknown;
  rentalStartDate?: unknown;
  rentalEndDate?: unknown;
  rentFrom?: unknown;
  rentTo?: unknown;
  depositAmount?: unknown;
  depositPaid?: unknown;
  products?: unknown;
  items?: unknown;
  customFields?: unknown;
}

interface AutoCleanApiProduct {
  name?: unknown;
  productName?: unknown;
  size?: unknown;
  quantity?: unknown;
  qty?: unknown;
  unitPrice?: unknown;
  price?: unknown;
}

interface RawPageResponse<T> {
  content?: T[];
  page?: number;
  size?: number;
  pageNumber?: number;
  pageSize?: number;
  totalElements?: number;
  totalPages?: number;
}

interface OrderApi {
  id?: string | number;
  orderCode?: string;
  orderType?: string;
  status?: string;
  paymentStatus?: string;
  sourceMethod?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerNote?: string;
  sourceChannel?: string;
  shippingMethod?: string;
  shippingFee?: number;
  totalAmount?: number;
  createdByFullName?: string;
  createdByUsername?: string;
  createdAt?: string;
  updatedAt?: string;
  paymentMethod?: string;
  items?: OrderItemApi[];
  customFieldValues?: any[];
  rentalInfo?: {
    rentFrom?: string;
    rentTo?: string;
    depositPaid?: number;
    returnStatus?: string;
    returnedAt?: string;
  };
}

interface OrderItemApi {
  id?: string | number;
  variantId?: string | number;
  productId?: string | number;
  productNameSnapshot?: string;
  productImageSnapshot?: string;
  categoryNameSnapshot?: string;
  skuSnapshot?: string;
  variantSizeSnapshot?: string;
  variantColorSnapshot?: string;
  quantity?: number;
  unitPrice?: number;
  lineTotal?: number;
}

@Injectable({ providedIn: 'root' })
export class OrdersApiService {
  private readonly httpService = inject(HttpService);
  private readonly endpoint = API_ENDPOINTS.orders;

  list(query: OrdersQuery): Observable<PageResponse<Order>> {
    return this.httpService
      .get<RawPageResponse<OrderApi> | ApiEnvelope<RawPageResponse<OrderApi>>>(this.endpoint, {
        params: {
          page: query.page,
          size: query.size,
          keyword: query.search,
          status: query.status,
          type: query.orderType,
          fromDate: query.fromDate,
          toDate: query.toDate
        }
      })
      .pipe(
        map((res) => unwrapApiResponse(res)),
        map((res) => normalizePageResponse(res))
      );
  }

  listByType(type: OrderType, query: OrdersQuery): Observable<PageResponse<Order>> {
    if (type === 'RENT') {
      return this.listRent(query);
    }

    return this.listSell(query);
  }

  listRent(query: OrdersQuery): Observable<PageResponse<Order>> {
    return this.list({ ...query, orderType: 'RENT' });
  }

  listSell(query: OrdersQuery): Observable<PageResponse<Order>> {
    return this.list({ ...query, orderType: 'SELL' });
  }

  getById(orderId: string): Observable<Order> {
    return this.httpService
      .get<OrderApi | ApiEnvelope<OrderApi>>(`${this.endpoint}/${orderId}`)
      .pipe(map((res) => normalizeOrder(unwrapApiResponse(res))));
  }

  create(input: CreateOrderInput): Observable<Order> {
    const items = input.products.map((p: CreateOrderProductInput) => ({
      variantId: p.variantId,
      quantity: p.quantity
    }));

    const payload = {
      orderType: input.orderType,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerAddress: input.customerAddress,
      customerNote: input.customerNote,
      sourceMethod: input.sourceMethod || 'MANUAL',
      sourceChannel: input.sourceChannel,
      sourceChannelId: input.sourceChannelId,
      shippingMethod: input.shippingMethod,
      shippingMethodId: input.shippingMethodId,
      shippingFee: input.shippingFee,
      paymentMethod: input.paymentMethod,
      items,
      customFieldValues: input.customFieldValues,
      rentFrom: input.rentFrom,
      rentTo: input.rentTo,
      depositPaid: input.depositPaid
    };

    return this.httpService
      .post<OrderApi | ApiEnvelope<OrderApi>, any>(this.endpoint, payload)
      .pipe(map((res) => normalizeOrder(unwrapApiResponse(res))));
  }

  cleanOrderText(rawText: string, orderTypeHint?: OrderType): Observable<AutoOrderDraft> {
    return this.httpService
      .post<AutoCleanApiResponse | ApiEnvelope<AutoCleanApiResponse>, { rawText: string; orderTypeHint?: OrderType }>(
        API_ENDPOINTS.orderAutoClean,
        { rawText, orderTypeHint }
      )
      .pipe(
        map((response) => unwrapApiResponse(response)),
        map((response) => normalizeAutoOrderDraft(response))
      );
  }

  updateStatus(orderId: string | number, status: OrderStatus): Observable<Order> {
    return this.httpService
      .patch<OrderApi | ApiEnvelope<OrderApi>, any>(`${this.endpoint}/${orderId}/status`, {}, {
        params: { status }
      })
      .pipe(map((res) => normalizeOrder(unwrapApiResponse(res))));
  }
}

function normalizePageResponse(raw: RawPageResponse<OrderApi>): PageResponse<Order> {
  return {
    content: (raw.content ?? []).map((item) => normalizeOrder(item)),
    page: asNumber(raw.page, asNumber(raw.pageNumber, 0)),
    size: asNumber(raw.size, asNumber(raw.pageSize, 20)),
    totalElements: asNumber(raw.totalElements, 0),
    totalPages: asNumber(raw.totalPages, 0)
  };
}

function normalizeOrder(raw: OrderApi): Order {
  return {
    id: asString(raw.id),
    orderCode: raw.orderCode || '',
    orderNumber: raw.orderCode, // Fallback orderNumber to orderCode
    orderType: (raw.orderType as OrderType) || 'SELL',
    status: (raw.status as OrderStatus) || 'NEW',
    paymentStatus: raw.paymentStatus as any,
    paymentMethod: raw.paymentMethod as any,
    sourceMethod: raw.sourceMethod as any,
    customerName: raw.customerName || '',
    customerPhone: raw.customerPhone || '',
    customerAddress: raw.customerAddress || '',
    customerNote: raw.customerNote || '',
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt,
    totalAmount: asNumber(raw.totalAmount, 0),
    sourceChannel: raw.sourceChannel,
    shippingMethod: raw.shippingMethod,
    shippingFee: asNumber(raw.shippingFee, 0),
    products: (raw.items ?? []).map((item) => normalizeOrderItem(item)),
    createdByFullName: raw.createdByFullName,
    createdByUsername: raw.createdByUsername,
    customFieldValues: raw.customFieldValues,
    rentFrom: raw.rentalInfo?.rentFrom,
    rentTo: raw.rentalInfo?.rentTo,
    depositPaid: raw.rentalInfo?.depositPaid,
    returnStatus: raw.rentalInfo?.returnStatus,
    returnedAt: raw.rentalInfo?.returnedAt
  };
}

function normalizeOrderItem(raw: OrderItemApi): any {
  return {
    id: asString(raw.id),
    variantId: asString(raw.variantId),
    productId: asString(raw.productId),
    productNameSnapshot: raw.productNameSnapshot,
    productImageSnapshot: raw.productImageSnapshot,
    categoryNameSnapshot: raw.categoryNameSnapshot,
    skuSnapshot: raw.skuSnapshot,
    variantSizeSnapshot: raw.variantSizeSnapshot,
    variantColorSnapshot: raw.variantColorSnapshot,
    name: raw.productNameSnapshot, // Map snapshot to name for UI
    size: raw.variantSizeSnapshot, // Map snapshot to size for UI
    quantity: asNumber(raw.quantity, 1),
    unitPrice: asNumber(raw.unitPrice, 0),
    lineTotal: asNumber(raw.lineTotal, 0)
  };
}

function normalizeAutoOrderDraft(raw: AutoCleanApiResponse): AutoOrderDraft {
  const orderType = normalizeOrderType(raw.orderType ?? raw.type);
  const customerName = asOptionalString(raw.customerName ?? raw.customer_name);
  const customerPhone = asOptionalString(raw.customerPhone ?? raw.phone);
  const customerAddress = asOptionalString(raw.customerAddress ?? raw.address);
  const customerNote = asOptionalString(raw.customerNote ?? raw.note);
  const sourceChannel = asOptionalString(raw.sourceChannel);
  const shippingMethod = asOptionalString(raw.shippingMethod);
  const shippingFee = asOptionalNumber(raw.shippingFee);
  const rentFrom = normalizeDateInput(raw.rentFrom ?? raw.rentalStartDate);
  const rentTo = normalizeDateInput(raw.rentTo ?? raw.rentalEndDate);
  const depositPaid = asOptionalNumber(raw.depositPaid ?? raw.depositAmount);
  const products = normalizeProducts(raw.products ?? raw.items);
  const customFields = normalizeCustomFields(raw.customFields);

  return {
    orderType,
    customerName,
    customerPhone,
    customerAddress,
    customerNote,
    sourceChannel,
    shippingMethod,
    shippingFee,
    rentFrom,
    rentTo,
    depositPaid,
    products: products.length > 0 ? products : undefined,
    customFields
  };
}

function normalizeOrderType(value: unknown): OrderType | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  const normalizedAscii = normalized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalizedAscii === 'SELL' || normalizedAscii.includes('BAN')) {
    return 'SELL';
  }

  if (normalizedAscii === 'RENT' || normalizedAscii.includes('THUE')) {
    return 'RENT';
  }

  return undefined;
}

function normalizeProducts(value: unknown): CreateOrderProductInput[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeProduct(item))
    .filter((item): item is CreateOrderProductInput => item !== null);
}

function normalizeProduct(value: unknown): CreateOrderProductInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const product = value as AutoCleanApiProduct;
  const name = asOptionalString(product.name ?? product.productName);

  if (!name) {
    return null;
  }

  const size = asOptionalString(product.size) ?? 'Free';
  const quantity = Math.max(
    1,
    Math.round(asOptionalNumber(product.quantity ?? product.qty) ?? 1)
  );
  const unitPrice = Math.max(
    0,
    Math.round(asOptionalNumber(product.unitPrice ?? product.price) ?? 0)
  );

  return {
    name,
    size,
    quantity,
    unitPrice
  };
}

function normalizeDateInput(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();

  if (!normalized) {
    return undefined;
  }

  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (dateOnlyPattern.test(normalized)) {
    return normalized;
  }

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeCustomFields(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).filter(([, fieldValue]) => {
    if (fieldValue === null || fieldValue === undefined) {
      return false;
    }

    if (typeof fieldValue === 'string') {
      return fieldValue.trim().length > 0;
    }

    if (Array.isArray(fieldValue)) {
      return fieldValue.length > 0;
    }

    return true;
  });

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

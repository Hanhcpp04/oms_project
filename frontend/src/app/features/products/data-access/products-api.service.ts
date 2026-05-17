import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/app.constants';
import { HttpService } from '../../../core/http/http.service';
import { PageResponse } from '../../../core/models/pagination.model';
import {
  CreateProductRequest,
  Product,
  ProductCustomAttribute,
  ProductImage,
  ProductsQuery,
  ProductVariant
} from './models/product.model';
import { asNullableNumber, asNumber, asString, isRecord, unwrapApiResponse } from '../../../core/utils/api-response.util';

export type ProductsViewMode = 'all' | 'rent' | 'sell';

interface ApiEnvelope<T> {
  data?: T;
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

interface ProductApi {
  id?: string | number;
  name?: string;
  description?: string;
  categoryName?: string;
  productType?: string;
  isActive?: boolean;
  createdAt?: string;
  variants?: ProductVariantApi[];
  images?: ProductImageApi[];
  customAttributes?: unknown;
  customAttributesJson?: unknown;
}

interface ProductVariantApi {
  id?: string | number;
  sku?: string;
  size?: string;
  color?: string;
  stockQty?: number;
  priceSell?: number;
  priceRentPerDay?: number;
  depositAmount?: number;
  isActive?: boolean;
}

interface ProductImageApi {
  id?: string | number;
  url?: string;
  altText?: string;
  sortOrder?: number;
}

interface ProductCustomAttributeApi {
  id?: string | number;
  fieldId?: string | number;
  fieldKey?: string;
  label?: string;
  value?: unknown;
}

export interface ProductQrCode {
  id: string;
  qrUrl: string;
  amount: number;
  note: string;
  productNameAtTime: string;
  createdByFullName: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ProductsApiService {
  private readonly httpService = inject(HttpService);
  private readonly endpoint = API_ENDPOINTS.products;

  listByView(view: ProductsViewMode, query: ProductsQuery): Observable<PageResponse<Product>> {
    if (view === 'rent') {
      return this.list({ ...query, type: 'RENT' });
    }

    if (view === 'sell') {
      return this.list({ ...query, type: 'SELL' });
    }

    return this.list(query);
  }

  list(query: ProductsQuery): Observable<PageResponse<Product>> {
    return this.httpService
      .get<RawPageResponse<ProductApi> | ApiEnvelope<RawPageResponse<ProductApi>>>(this.endpoint, {
        params: {
          keyword: query.search,
          type: query.type,
          categoryName: query.category,
          page: query.page,
          size: query.size
        }
      })
      .pipe(
        map((response) => unwrapApiResponse(response)),
        map((response) => normalizePageResponse(response))
      );
  }

  getById(productId: string): Observable<Product> {
    return this.httpService
      .get<ProductApi | ApiEnvelope<ProductApi>>(`${this.endpoint}/${productId}`)
      .pipe(map((response) => normalizeProduct(unwrapApiResponse(response))));
  }

  create(request: CreateProductRequest): Observable<Product> {
    return this.httpService
      .post<ProductApi | ApiEnvelope<ProductApi>, CreateProductRequest>(this.endpoint, request)
      .pipe(map((response) => normalizeProduct(unwrapApiResponse(response))));
  }

  update(productId: string, request: CreateProductRequest): Observable<Product> {
    return this.httpService
      .put<ProductApi | ApiEnvelope<ProductApi>, CreateProductRequest>(`${this.endpoint}/${productId}`, request)
      .pipe(map((response) => normalizeProduct(unwrapApiResponse(response))));
  }

  deactivate(productId: string): Observable<void> {
    return this.httpService
      .delete<void | ApiEnvelope<void>>(`${this.endpoint}/${productId}`)
      .pipe(map(() => undefined));
  }

  restore(productId: string): Observable<Product> {
    return this.httpService
      .patch<ProductApi | ApiEnvelope<ProductApi>, null>(`${this.endpoint}/${productId}/restore`, null)
      .pipe(map((response) => normalizeProduct(unwrapApiResponse(response))));
  }

  generateQrCode(productId: string, amount: number, note?: string): Observable<ProductQrCode> {
    return this.httpService
      .post<ProductQrCode | ApiEnvelope<ProductQrCode>, { amount: number; note?: string }>(
        `${this.endpoint}/${productId}/qr-code`,
        { amount, note }
      )
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  getQrCodeHistory(productId: string): Observable<ProductQrCode[]> {
    return this.httpService
      .get<ProductQrCode[] | ApiEnvelope<ProductQrCode[]>>(`${this.endpoint}/${productId}/qr-code-history`)
      .pipe(map((response) => unwrapApiResponse(response)));
  }
}

// Shared api response utilities are imported from core/utils/api-response.util.ts

function normalizePageResponse(raw: RawPageResponse<ProductApi>): PageResponse<Product> {
  return {
    content: (raw.content ?? []).map((item) => normalizeProduct(item)),
    page: asNumber(raw.page, asNumber(raw.pageNumber, 0)),
    size: asNumber(raw.size, asNumber(raw.pageSize, 20)),
    totalElements: asNumber(raw.totalElements, 0),
    totalPages: asNumber(raw.totalPages, 0)
  };
}

function normalizeProduct(raw: ProductApi): Product {
  return {
    id: asString(raw.id),
    name: raw.name?.trim() || 'San pham chua dat ten',
    description: raw.description?.trim() || '',
    productType: normalizeProductType(raw.productType),
    category: raw.categoryName,
    active: Boolean(raw.isActive ?? true),
    createdAt: raw.createdAt || new Date().toISOString(),
    variants: (raw.variants ?? []).map((variant) => normalizeVariant(variant)),
    images: (raw.images ?? []).map((image) => normalizeImage(image)),
    customAttributes: normalizeCustomAttributes(raw.customAttributes ?? raw.customAttributesJson),
    customAttributeValues: normalizeCustomAttributeValues(raw.customAttributes ?? raw.customAttributesJson)
  };
}

function normalizeVariant(raw: ProductVariantApi): ProductVariant {
  return {
    id: asString(raw.id),
    sku: raw.sku?.trim() || undefined,
    size: raw.size?.trim() || '--',
    color: raw.color?.trim() || '--',
    stockQty: asNumber(raw.stockQty, 0),
    priceSell: asNullableNumber(raw.priceSell),
    priceRentPerDay: asNullableNumber(raw.priceRentPerDay),
    depositAmount: asNullableNumber(raw.depositAmount),
    active: Boolean(raw.isActive ?? true)
  };
}

function normalizeImage(raw: ProductImageApi): ProductImage {
  return {
    id: asString(raw.id),
    url: raw.url?.trim() || '',
    altText: raw.altText?.trim() || '',
    sortOrder: asNumber(raw.sortOrder, 0)
  };
}

function normalizeProductType(value: unknown): 'SELL' | 'RENT' | 'SELL_RENT' {
  switch (value) {
    case 'SELL':
    case 'RENT':
    case 'SELL_RENT':
      return value;
    default:
      return 'SELL';
  }
}

function normalizeCustomAttributes(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) {
    const record: Record<string, unknown> = {};
    for (const attr of value) {
      if (attr && typeof attr === 'object' && 'fieldId' in attr && 'value' in attr) {
        record[String(attr.fieldId)] = parseCustomAttributeValue(attr.value);
      }
    }
    return Object.keys(record).length > 0 ? record : undefined;
  }

  if (isRecord(value)) {
    return value;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function normalizeCustomAttributeValues(value: unknown): ProductCustomAttribute[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const attributes = value
    .filter((item): item is ProductCustomAttributeApi => isRecord(item))
    .map((item) => ({
      id: asString(item.id),
      fieldId: asString(item.fieldId),
      fieldKey: item.fieldKey?.trim() || '',
      label: item.label?.trim() || item.fieldKey?.trim() || asString(item.fieldId),
      value: parseCustomAttributeValue(item.value)
    }))
    .filter((item) => item.fieldId || item.label);

  return attributes.length > 0 ? attributes : undefined;
}

function parseCustomAttributeValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  if (!value.trim()) {
    return '';
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

// Shared api response utilities are imported from core/utils/api-response.util.ts

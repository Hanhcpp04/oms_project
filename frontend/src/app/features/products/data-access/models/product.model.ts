export type ProductType = 'SELL' | 'RENT' | 'SELL_RENT';

export interface ProductVariant {
  id: string;
  sku?: string;
  size: string;
  color: string;
  stockQty: number;
  priceSell: number | null;
  priceRentPerDay: number | null;
  depositAmount: number | null;
  active: boolean;
}

export interface ProductImage {
  id: string;
  url: string;
  altText: string;
  sortOrder: number;
}

export interface ProductCustomAttribute {
  id: string;
  fieldId: string;
  fieldKey: string;
  label: string;
  value: unknown;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  productType: ProductType;
  category?: string;
  active: boolean;
  createdAt: string;
  variants: ProductVariant[];
  images: ProductImage[];
  customAttributes?: Record<string, unknown>;
  customAttributeValues?: ProductCustomAttribute[];
}

export interface ProductsQuery {
  page: number;
  size: number;
  search?: string;
  type?: ProductType;
  category?: string;
}

export interface VariantInput {
  id?: string;
  size: string;
  color: string;
  stockQty: number;
  priceSell?: number;
  priceRentPerDay?: number;
  depositAmount?: number;
}

export interface CreateProductInput {
  name: string;
  description: string;
  productType: ProductType;
  category: string;
  variants: VariantInput[];
  imageUrls?: string[];
  customAttributes?: Record<string, unknown>;
}

export interface CreateProductRequest {
  name: string;
  description: string;
  productType: ProductType;
  categoryName?: string;
  variants: Array<{
    size: string;
    color: string;
    stockQty: number;
    priceSell?: number;
    priceRentPerDay?: number;
    depositAmount?: number;
  }>;
  imageUrls: string[];
  customAttributes?: Array<{
    fieldId: number;
    value: string;
  }>;
}

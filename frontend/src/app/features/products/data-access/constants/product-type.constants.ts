import { ProductType } from '../models/product.model';

export const PRODUCT_TYPE_OPTIONS: ReadonlyArray<{ label: string; value: ProductType }> = [
  { label: 'Ban', value: 'SELL' },
  { label: 'Cho thue', value: 'RENT' },
  { label: 'Ban + Cho thue', value: 'SELL_RENT' }
];

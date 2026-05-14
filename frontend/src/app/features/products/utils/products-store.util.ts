import {
    CreateProductInput,
    CreateProductRequest,
    Product,
    ProductsQuery
} from '../data-access/models/product.model';

export function toCreateProductRequest(input: CreateProductInput): CreateProductRequest {
    const customAttributes = input.customAttributes 
        ? Object.entries(input.customAttributes)
            .map(([fieldId, val]) => ({
                fieldId: Number(fieldId),
                value: JSON.stringify(
                    typeof val === 'object' && val !== null && 'value' in val 
                        ? (val as any).value 
                        : val
                )
            }))
            .filter(attr => !Number.isNaN(attr.fieldId))
        : [];

    return {
        name: input.name.trim(),
        description: input.description.trim(),
        productType: input.productType,
        categoryName: input.category,
        variants: input.variants.map(v => ({
            id: v.id && !v.id.startsWith('local-') ? Number(v.id) : undefined,
            size: v.size.trim() || 'M',
            color: v.color.trim() || 'Mac dinh',
            stockQty: Math.max(v.stockQty, 0),
            priceSell: normalizePrice(v.priceSell),
            priceRentPerDay: normalizePrice(v.priceRentPerDay),
            depositAmount: normalizePrice(v.depositAmount)
        })),
        imageUrls: input.imageUrls ?? [],
        customAttributes: customAttributes.length > 0 ? customAttributes : undefined
    };
}

export function normalizeCustomAttributes(value: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(value)) {
    const record: Record<string, unknown> = {};
    for (const attr of value) {
      if (attr && typeof attr === 'object' && 'fieldId' in attr && 'value' in attr) {
        try {
          record[String(attr.fieldId)] = typeof attr.value === 'string' ? JSON.parse(attr.value) : attr.value;
        } catch {
          record[String(attr.fieldId)] = attr.value;
        }
      }
    }
    return Object.keys(record).length > 0 ? record : undefined;
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

export function normalizePrice(value: number | undefined): number | undefined {
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
        return undefined;
    }

    return Math.round(value);
}

export function createLocalProduct(input: CreateProductInput): Product {
    const now = new Date().toISOString();

    return {
        id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: input.name.trim() || 'San pham moi',
        description: input.description.trim(),
        productType: input.productType,
        active: true,
        createdAt: now,
        variants: input.variants.map((v, idx) => ({
            id: v.id ?? `var-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}-${idx}`,
            size: v.size.trim() || 'M',
            color: v.color.trim() || 'Mac dinh',
            stockQty: Math.max(v.stockQty, 0),
            priceSell: normalizePrice(v.priceSell) ?? null,
            priceRentPerDay: normalizePrice(v.priceRentPerDay) ?? null,
            depositAmount: normalizePrice(v.depositAmount) ?? null,
            active: true
        })),
        images: (input.imageUrls ?? []).map((url, index) => ({
            id: `img-${Date.now().toString(36)}-${index}`,
            url,
            altText: input.name.trim() || 'San pham moi',
            sortOrder: index
        })),
        customAttributes: input.customAttributes
            ? { ...input.customAttributes }
            : undefined
    };
}

export function buildUpdatedLocalProduct(current: Product, input: CreateProductInput): Product {
    const primaryVariant = current.variants[0];
    const primaryImage = current.images[0];

    return {
        ...current,
        name: input.name.trim() || current.name,
        description: input.description.trim(),
        productType: input.productType,
        variants: input.variants.map((v, idx) => ({
            id: v.id ?? `var-${Date.now().toString(36)}-${idx}`,
            size: v.size.trim() || 'M',
            color: v.color.trim() || 'Mac dinh',
            stockQty: Math.max(v.stockQty, 0),
            priceSell: normalizePrice(v.priceSell) ?? null,
            priceRentPerDay: normalizePrice(v.priceRentPerDay) ?? null,
            depositAmount: normalizePrice(v.depositAmount) ?? null,
            active: true
        })),
        images: (input.imageUrls ?? []).map((url, index) => ({
            id: current.images[index]?.id ?? `img-${Date.now().toString(36)}-${index}`,
            url,
            altText: input.name.trim() || current.name,
            sortOrder: index
        })),
        customAttributes: input.customAttributes
            ? { ...input.customAttributes }
            : current.customAttributes
    };
}

export function filterLocalProducts(products: Product[], query: ProductsQuery): Product[] {
    const normalizedSearch = query.search?.trim().toLowerCase() ?? '';

    const filtered = products.filter((product) => {
        const matchSearch =
            normalizedSearch.length === 0 ||
            product.name.toLowerCase().includes(normalizedSearch) ||
            product.description.toLowerCase().includes(normalizedSearch);

        const matchType = matchesProductTypeFilter(product.productType, query.type);
        const matchCategory = !query.category || product.category === query.category;

        return matchSearch && matchType && matchCategory;
    });

    const start = query.page * query.size;
    return filtered.slice(start, start + query.size);
}

export function matchesProductTypeFilter(productType: Product['productType'], filterType: ProductsQuery['type']): boolean {
    if (!filterType) {
        return true;
    }

    if (filterType === 'SELL') {
        return productType === 'SELL' || productType === 'SELL_RENT';
    }

    if (filterType === 'RENT') {
        return productType === 'RENT' || productType === 'SELL_RENT';
    }

    return productType === filterType;
}

export function formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
        maximumFractionDigits: 0
    }).format(value);
}

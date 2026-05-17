const VND_FORMATTER = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0
});

const MONEY_KEYWORDS = [
  'amount',
  'currency',
  'deposit',
  'fee',
  'coc',
  'dongia',
  'giaban',
  'giathue',
  'price',
  'phi',
  'revenue',
  'shippingfee',
  'tien',
  'total',
  'unitprice'
];

const MONEY_FIELD_KEYS = new Set([
  'amount',
  'depositamount',
  'depositpaid',
  'discountamount',
  'price',
  'pricerentperday',
  'pricesell',
  'rentalprice',
  'revenue',
  'shippingfee',
  'subtotal',
  'total',
  'totalamount',
  'unitprice'
]);

export function formatVndCurrency(
  value: number | string | null | undefined,
  fallback = '--'
): string {
  const amount = parseVndCurrencyInput(value);

  if (amount === undefined) {
    return fallback;
  }

  return VND_FORMATTER.format(Math.round(amount)).replace(/\u00A0/g, ' ');
}

export function formatVndCurrencyInput(value: number | string | null | undefined): string {
  return formatVndCurrency(value, '');
}

export function normalizeVndCurrencyInput(value: number | string | null | undefined): string {
  const amount = parseVndCurrencyInput(value);
  return amount === undefined ? '' : String(Math.max(0, Math.round(amount)));
}

export function parseVndCurrencyInput(
  value: number | string | null | undefined
): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (value === null || value === undefined) {
    return undefined;
  }

  const text = String(value).trim();
  if (!text) {
    return undefined;
  }

  const isNegative = text.startsWith('-');
  const digits = text.replace(/\D/g, '');

  if (!digits) {
    return undefined;
  }

  const parsed = Number(digits);
  if (!Number.isFinite(parsed)) {
    return undefined;
  }

  return isNegative ? -parsed : parsed;
}

export function isCurrencyFieldLike(input: {
  fieldKey?: string | null;
  label?: string | null;
  source?: unknown;
}): boolean {
  const source = isRecord(input.source) ? input.source : {};
  const candidates = [
    input.fieldKey,
    input.label,
    source['fieldKey'],
    source['semanticKey'],
    source['coreKey'],
    source['label']
  ]
    .map((value) => normalizeLookup(String(value ?? '')))
    .filter(Boolean);

  return candidates.some((value) => {
    if (MONEY_FIELD_KEYS.has(value)) {
      return true;
    }

    return MONEY_KEYWORDS.some((keyword) => value.includes(keyword));
  });
}

function normalizeLookup(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

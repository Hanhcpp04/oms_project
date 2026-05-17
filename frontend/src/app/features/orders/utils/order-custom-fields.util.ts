import { Order } from '../data-access/models/order.model';
import { formatVndCurrency, isCurrencyFieldLike, parseVndCurrencyInput } from '../../../shared/utils/currency.util';

export interface CustomFieldDisplayEntry {
  key: string;
  label: string;
  value: string;
  type?: string;
}

export function getOrderCustomFieldDisplayEntries(order: Order | null | undefined): CustomFieldDisplayEntry[] {
  if (order?.customFieldValues && Array.isArray(order.customFieldValues)) {
    return order.customFieldValues
      .filter(cfv => cfv.showInDetailSnapshot !== false) // Only show if not hidden
      .map(cfv => {
        let value = cfv.valueJson;
        try {
          value = JSON.parse(cfv.valueJson);
        } catch {
          // ignore
        }
        const type = normalizeFieldType(cfv.formTypeSnapshot);

        return {
          key: cfv.fieldKeySnapshot,
          label: cfv.labelSnapshot,
          value: type === 'image'
            ? resolveImageValue(value)
            : formatDisplayValue(value, { fieldKey: cfv.fieldKeySnapshot, label: cfv.labelSnapshot }),
          type
        };
      });
  }

  // Fallback to legacy customFields
  if (!order?.customFields || !isRecord(order.customFields)) {
    return [];
  }

  return Object.entries(order.customFields).map(([key, rawFieldValue]) => {
    const type = resolveFieldType(rawFieldValue);
    const rawValue = unwrapFieldValue(rawFieldValue);
    const label = resolveFieldLabel(key, rawFieldValue);

    return {
      key,
      label,
      value: type === 'image' ? resolveImageValue(rawValue) : formatDisplayValue(rawValue, { fieldKey: key, label }),
      type
    };
  });
}

function resolveFieldLabel(key: string, rawFieldValue: unknown): string {
  if (isRecord(rawFieldValue) && typeof rawFieldValue['label'] === 'string') {
    const label = rawFieldValue['label'].trim();

    if (label) {
      return label;
    }
  }

  return humanizeKey(key);
}

function resolveFieldValue(rawFieldValue: unknown): string {
  return formatDisplayValue(unwrapFieldValue(rawFieldValue));
}

function unwrapFieldValue(rawFieldValue: unknown): unknown {
  return isRecord(rawFieldValue) && Object.prototype.hasOwnProperty.call(rawFieldValue, 'value')
    ? rawFieldValue['value']
    : rawFieldValue;
}

function resolveFieldType(rawFieldValue: unknown): string | undefined {
  if (!isRecord(rawFieldValue)) {
    return undefined;
  }

  const type = rawFieldValue['type'] ?? rawFieldValue['fieldType'] ?? rawFieldValue['formType'];

  return typeof type === 'string' ? normalizeFieldType(type) : undefined;
}

function normalizeFieldType(type: string | undefined): string | undefined {
  if (!type) {
    return undefined;
  }

  const normalized = type.trim().toLowerCase();

  if (['image', 'file_image', 'image_upload', 'upload_image'].includes(normalized)) {
    return 'image';
  }

  return normalized;
}

function resolveImageValue(value: unknown): string {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || '';
  }

  if (Array.isArray(value)) {
    const firstImage = value
      .map((item) => resolveImageValue(item))
      .find((item) => item.length > 0);

    return firstImage ?? '';
  }

  if (isRecord(value)) {
    const imageValue =
      value['url'] ??
      value['fileUrl'] ??
      value['imageUrl'] ??
      value['path'] ??
      value['src'] ??
      value['value'];

    return resolveImageValue(imageValue);
  }

  return '';
}

function formatDisplayValue(value: unknown, field?: { fieldKey?: string; label?: string }): string {
  if (value === null || value === undefined) {
    return '(trống)';
  }

  if (field && isCurrencyFieldLike(field)) {
    const amount = parseVndCurrencyInput(
      typeof value === 'string' || typeof value === 'number' ? value : undefined
    );

    if (amount !== undefined) {
      return formatVndCurrency(amount);
    }
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized || '(trống)';
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '(trống)';
    }

    const parts = value.map((item) => formatDisplayValue(item)).filter((part) => part !== '(trống)');

    return parts.length > 0 ? parts.join(', ') : '(trống)';
  }

  if (isRecord(value)) {
    const parts = Object.entries(value)
      .map(([key, nestedValue]) => `${humanizeKey(key)}: ${formatDisplayValue(nestedValue)}`)
      .filter((line) => !line.endsWith(': (trống)'));

    return parts.length > 0 ? parts.join(' | ') : '(trống)';
  }

  return String(value);
}

function humanizeKey(value: string): string {
  const normalized = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();

  if (!normalized) {
    return 'Trường bổ sung';
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

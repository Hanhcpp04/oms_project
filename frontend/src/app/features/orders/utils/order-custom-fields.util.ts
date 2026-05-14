import { Order } from '../data-access/models/order.model';

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
        return {
          key: cfv.fieldKeySnapshot,
          label: cfv.labelSnapshot,
          value: formatDisplayValue(value),
          type: cfv.formTypeSnapshot
        };
      });
  }

  // Fallback to legacy customFields
  if (!order?.customFields || !isRecord(order.customFields)) {
    return [];
  }

  return Object.entries(order.customFields).map(([key, rawFieldValue]) => ({
    key,
    label: resolveFieldLabel(key, rawFieldValue),
    value: resolveFieldValue(rawFieldValue)
  }));
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
  const value = isRecord(rawFieldValue) && Object.prototype.hasOwnProperty.call(rawFieldValue, 'value')
    ? rawFieldValue['value']
    : rawFieldValue;

  return formatDisplayValue(value);
}

function formatDisplayValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '(trống)';
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
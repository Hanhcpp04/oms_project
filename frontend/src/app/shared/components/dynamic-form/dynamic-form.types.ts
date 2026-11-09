export type DynamicFormContext = 'product' | 'order' | 'public';
export type DynamicFormMode = 'create' | 'edit' | 'preview';
export type DynamicFormVariant = 'public' | 'internal' | 'preview';

export type DynamicFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'phone'
  | 'email'
  | 'date'
  | 'time'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'image'
  | 'file';

export type DynamicFieldValue = string | string[] | null | undefined;

export interface DynamicFieldOption {
  id: string;
  label: string;
  value: string;
}

export interface DynamicFieldValidationState {
  valid: boolean;
  errors: Record<string, string[]>;
}

export interface DynamicRenderField {
  id: string;
  fieldKey: string;
  label: string;
  type: DynamicFieldType;
  placeholder: string;
  helperText: string;
  required: boolean;
  active: boolean;
  sortOrder: number;
  validationRules: Record<string, unknown>;
  options: DynamicFieldOption[];
  source: unknown;
}

type RawField = Record<string, unknown>;
type RawOption = Record<string, unknown>;

export function normalizeDynamicFields(fields: readonly unknown[] | null | undefined): DynamicRenderField[] {
  return (fields ?? [])
    .map((field) => normalizeDynamicField(field))
    .filter((field): field is DynamicRenderField => field !== null && field.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function normalizeDynamicField(field: unknown): DynamicRenderField | null {
  if (!isRecord(field)) {
    return null;
  }

  const id = asString(field['id']);
  if (!id) {
    return null;
  }

  const rawType = field['type'] ?? field['fieldType'];
  const validationRules = parseValidationRules(field);

  return {
    id,
    fieldKey: asString(field['fieldKey']),
    label: asString(field['label']) || 'Trường mới',
    type: normalizeFieldType(rawType),
    placeholder: asString(field['placeholder']),
    helperText: asString(field['helperText'] ?? field['helpText']),
    required: Boolean(field['required'] ?? field['isRequired'] ?? false),
    active: resolveActiveState(field),
    sortOrder: asNumber(field['sortOrder'], 0),
    validationRules,
    options: normalizeOptions(field['options']),
    source: field
  };
}

export function getDynamicOptionValue(
  field: DynamicRenderField,
  option: DynamicFieldOption,
  context: DynamicFormContext
): string {
  if (context === 'product') {
    return option.value;
  }

  if (context === 'public') {
    return option.label;
  }

  if (field.type === 'radio' || field.type === 'checkbox') {
    return option.label;
  }

  return option.value;
}

function normalizeOptions(value: unknown): DynamicFieldOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .map((option, index) => normalizeOption(option, index))
    .filter((option): option is DynamicFieldOption => option !== null);
}

function normalizeOption(option: RawOption, index: number): DynamicFieldOption | null {
  const active = option['active'] ?? option['isActive'];
  if (active === false) {
    return null;
  }

  const label = asString(option['label']);
  const value = asString(option['value']) || label;
  const id = asString(option['id']) || value || String(index);

  if (!label && !value) {
    return null;
  }

  return {
    id,
    label: label || value,
    value: value || label
  };
}

function normalizeFieldType(value: unknown): DynamicFieldType {
  switch (value) {
    case 'textarea':
      return 'textarea';
    case 'number':
      return 'number';
    case 'phone':
      return 'phone';
    case 'email':
      return 'email';
    case 'date':
      return 'date';
    case 'time':
      return 'time';
    case 'dropdown':
    case 'select':
      return 'select';
    case 'single_choice':
    case 'radio':
      return 'radio';
    case 'multi_choice':
    case 'checkbox':
      return 'checkbox';
    case 'image':
      return 'image';
    case 'file':
      return 'file';
    default:
      return 'text';
  }
}

function resolveActiveState(field: RawField): boolean {
  if (field['enabled'] === false || field['active'] === false || field['isActive'] === false || field['isEnabled'] === false) {
    return false;
  }

  return true;
}

function parseValidationRules(field: RawField): Record<string, unknown> {
  const rules = field['validationRules'];
  if (isRecord(rules)) {
    return rules;
  }

  const rulesJson = field['validationRulesJson'];
  if (typeof rulesJson !== 'string' || !rulesJson.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(rulesJson);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

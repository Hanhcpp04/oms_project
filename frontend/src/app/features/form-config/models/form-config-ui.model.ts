import {
  OrderFormFieldOption,
  OrderFormFieldType,
  OrderFormTemplateField,
  OrderFormTemplateType
} from '../../../core/models/order-form-template.model';

export interface FieldTypeOption {
  label: string;
  value: OrderFormFieldType;
}

export const FIELD_TYPE_OPTIONS: ReadonlyArray<FieldTypeOption> = [
  { label: 'Text', value: 'text' },
  { label: 'Textarea', value: 'textarea' },
  { label: 'Number', value: 'number' },
  { label: 'Phone', value: 'phone' },
  { label: 'Email', value: 'email' },
  { label: 'Date', value: 'date' },
  { label: 'Select', value: 'dropdown' },
  { label: 'Radio', value: 'single_choice' },
  { label: 'Checkbox', value: 'multi_choice' },
  { label: 'File/Image upload', value: 'image' }
];

export function createEmptyOrderField(
  templateId: string,
  type: OrderFormFieldType,
  sortOrder: number
): OrderFormTemplateField {
  return {
    id: `temp-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    templateId,
    fieldKey: '',
    label: defaultLabelForType(type),
    type,
    placeholder: defaultPlaceholderForType(type),
    helperText: '',
    required: false,
    active: true,
    sortOrder,
    showInOrderList: false,
    showInOrderDetail: true,
    validationRules: {},
    options: defaultOptionsForType(type)
  };
}

export function duplicateOrderField(
  field: OrderFormTemplateField,
  sortOrder: number
): OrderFormTemplateField {
  return {
    ...structuredCloneSafe(field),
    id: `temp-${Date.now()}-${Math.round(Math.random() * 10000)}`,
    fieldKey: '',
    label: `${field.label || 'Trường mới'} (bản sao)`,
    sortOrder,
    options: field.options.map((option, index) => ({
      ...option,
      id: `temp-opt-${Date.now()}-${index}-${Math.round(Math.random() * 10000)}`
    }))
  };
}

export function normalizeFieldForSave(
  field: OrderFormTemplateField,
  index: number
): OrderFormTemplateField {
  return {
    ...field,
    label: field.label.trim(),
    placeholder: field.placeholder?.trim() ?? '',
    helperText: field.helperText?.trim() ?? '',
    sortOrder: index + 1,
    options: isChoiceField(field.type)
      ? field.options.map((option, optionIndex) => ({
          ...option,
          label: option.label.trim(),
          value: (option.value || option.label).trim(),
          sortOrder: optionIndex + 1,
          active: option.active !== false
        }))
      : []
  };
}

export function validateFields(fields: OrderFormTemplateField[]): Record<string, string[]> {
  return fields.reduce<Record<string, string[]>>((errors, field) => {
    const fieldErrors: string[] = [];

    if (!field.label?.trim()) {
      fieldErrors.push('Tên field không được trống.');
    }

    if (isChoiceField(field.type)) {
      const validOptions = field.options.filter((option) => option.label?.trim());
      if (validOptions.length === 0) {
        fieldErrors.push('Field dạng lựa chọn cần ít nhất 1 option.');
      }
    }

    if (fieldErrors.length > 0) {
      errors[field.id] = fieldErrors;
    }

    return errors;
  }, {});
}

export function isChoiceField(type: OrderFormFieldType): boolean {
  return type === 'dropdown' || type === 'single_choice' || type === 'multi_choice';
}

export function isTempId(id: string): boolean {
  return id.startsWith('temp-');
}

export function fieldTypeLabel(type: OrderFormFieldType): string {
  return FIELD_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? 'Text';
}

export function formTypeLabel(type: OrderFormTemplateType): string {
  return type === 'RENT' ? 'Đơn thuê' : 'Đơn bán';
}

export function defaultPlaceholderForType(type: OrderFormFieldType): string {
  switch (type) {
    case 'textarea':
      return 'Nhập nội dung chi tiết';
    case 'number':
      return 'Nhập số';
    case 'phone':
      return 'Nhập số điện thoại';
    case 'email':
      return 'Nhập email';
    case 'date':
      return 'Chọn ngày';
    case 'dropdown':
      return 'Chọn một lựa chọn';
    case 'single_choice':
    case 'multi_choice':
      return '';
    case 'image':
      return 'Tải ảnh lên';
    default:
      return 'Nhập câu trả lời';
  }
}

export function inputTypeForField(type: OrderFormFieldType): 'text' | 'email' | 'tel' | 'number' | 'date' {
  switch (type) {
    case 'email':
      return 'email';
    case 'phone':
      return 'tel';
    case 'number':
      return 'number';
    case 'date':
      return 'date';
    default:
      return 'text';
  }
}

function defaultLabelForType(type: OrderFormFieldType): string {
  switch (type) {
    case 'textarea':
      return 'Câu trả lời dài';
    case 'number':
      return 'Trường số';
    case 'phone':
      return 'Số điện thoại';
    case 'email':
      return 'Email';
    case 'date':
      return 'Ngày';
    case 'dropdown':
      return 'Danh sách lựa chọn';
    case 'single_choice':
      return 'Câu hỏi một lựa chọn';
    case 'multi_choice':
      return 'Câu hỏi nhiều lựa chọn';
    case 'image':
      return 'Tải ảnh';
    default:
      return 'Trường mới';
  }
}

function defaultOptionsForType(type: OrderFormFieldType): OrderFormFieldOption[] {
  if (!isChoiceField(type)) {
    return [];
  }

  return [
    {
      id: `temp-opt-${Date.now()}`,
      label: 'Lựa chọn 1',
      value: 'Lựa chọn 1',
      sortOrder: 1,
      active: true
    }
  ];
}

function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

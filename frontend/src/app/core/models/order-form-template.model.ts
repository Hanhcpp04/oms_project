export type OrderFormTemplateType = 'SELL' | 'RENT';
export type OrderFormTemplateStatus = 'ACTIVE' | 'ARCHIVED';

export type OrderFormFieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'textarea'
  | 'number'
  | 'date'
  | 'time'
  | 'single_choice'
  | 'multi_choice'
  | 'dropdown'
  | 'image';

export interface OrderFormFieldOption {
  id: string;
  label: string;
  value: string;
  sortOrder: number;
  active: boolean;
}

export interface OrderFormTemplateField {
  id: string;
  templateId: string;
  fieldKey: string;
  label: string;
  type: OrderFormFieldType;
  placeholder: string;
  helperText: string;
  required: boolean;
  active: boolean;
  sortOrder: number;
  showInOrderList: boolean;
  showInOrderDetail: boolean;
  validationRules?: Record<string, unknown>;
  options: OrderFormFieldOption[];
}

export interface OrderFormTemplate {
  id: string;
  templateType: OrderFormTemplateType;
  name: string;
  status: OrderFormTemplateStatus;
  fieldCount: number;
  updatedAt: string;
  fields: OrderFormTemplateField[];
}

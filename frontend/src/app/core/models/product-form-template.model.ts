export type ProductFormTemplateType = 'SELL' | 'RENT' | 'GENERAL';
export type ProductFormTemplateStatus = 'ACTIVE' | 'ARCHIVED';

export type ProductFormFieldType =
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

export type ProductFormCoreKey =
  | 'name'
  | 'description'
  | 'size'
  | 'color'
  | 'stockQty'
  | 'priceSell'
  | 'priceRentPerDay'
  | 'depositAmount'
  | 'imageUrl';

export interface ProductFormFieldOption {
  id: string;
  label: string;
  value: string;
  sortOrder: number;
  active: boolean;
}

export interface ProductFormTemplateField {
  id: string;
  templateId: string;
  fieldKey: string;
  coreKey?: ProductFormCoreKey;
  label: string;
  type: ProductFormFieldType;
  placeholder: string;
  helperText: string;
  required: boolean;
  enabled: boolean;
  sortOrder: number;
  validationRules?: Record<string, unknown>;
  options: ProductFormFieldOption[];
}

export interface ProductFormTemplate {
  id: string;
  templateType: ProductFormTemplateType;
  name: string;
  status: ProductFormTemplateStatus;
  fieldCount: number;
  updatedAt: string;
  fields: ProductFormTemplateField[];
}

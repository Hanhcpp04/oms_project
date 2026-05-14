export type FormFieldType =
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

export type FormFieldSemanticKey =
  | 'customerName'
  | 'customerPhone'
  | 'customerAddress'
  | 'note'
  | 'slaHours'
  | 'rentFrom'
  | 'rentTo'
  | 'depositAmount'
  | 'productName'
  | 'productQuantity'
  | 'orderType'
  | 'shippingMethod'
  | 'shippingFee'
  | 'sourceChannel';

export type FormTemplateType = 'PUBLIC' | 'ORDER_CAPTURE' | 'INTERNAL';
export type FormTemplateStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type FormTemplateCategory = 'rent' | 'sell' | 'general';

export interface FormFieldOption {
  id: string;
  label: string;
  value: string;
  sortOrder: number;
  active: boolean;
}

export interface FormTemplateField {
  id: string;
  templateId: string;
  fieldKey: string;
  label: string;
  type: FormFieldType;
  semanticKey?: FormFieldSemanticKey;
  placeholder: string;
  helperText: string;
  defaultValue?: string;
  required: boolean;
  active: boolean;
  showInOrderList: boolean;
  showInOrderDetail: boolean;
  sortOrder: number;
  validationRules?: Record<string, unknown>;
  options: FormFieldOption[];
}

export type FormTemplatePermission = 'view' | 'edit';

export interface FormTemplateMemberPermission {
  userId: string;
  permission: FormTemplatePermission;
}

export interface FormTemplateSharing {
  defaultPermission: FormTemplatePermission;
  memberPermissions: FormTemplateMemberPermission[];
}

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: FormTemplateCategory;
  formType: FormTemplateType;
  status: FormTemplateStatus;
  isPublic: boolean;
  publicSlug?: string;
  versionNo: number;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  fields: FormTemplateField[];
  sharing: FormTemplateSharing;
}

export interface FormTemplateInput {
  name: string;
  description: string;
  formType?: FormTemplateType;
  category?: FormTemplateCategory;
  isPublic?: boolean;
}

export interface FormTemplateFieldInput {
  label: string;
  type: FormFieldType;
  semanticKey?: FormFieldSemanticKey;
  placeholder?: string;
  helperText?: string;
  defaultValue?: string;
  required?: boolean;
  showInOrderList?: boolean;
  showInOrderDetail?: boolean;
}

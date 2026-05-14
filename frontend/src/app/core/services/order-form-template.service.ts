import { inject, Injectable, signal } from '@angular/core';
import { map, Observable, tap } from 'rxjs';
import { API_ENDPOINTS } from '../constants/app.constants';
import { AuthStore } from '../auth/auth.store';
import { HttpService } from '../http/http.service';
import { ShopSetupStatusService } from './shop-setup-status.service';
import {
  OrderFormFieldOption,
  OrderFormFieldType,
  OrderFormTemplate,
  OrderFormTemplateField,
  OrderFormTemplateType
} from '../models/order-form-template.model';
import { ApiEnvelope, asString, unwrapApiResponse } from '../utils/api-response.util';

interface OrderFormConfigApi {
  id: string | number;
  formType: string;
  createdAt: string;
  updatedAt: string;
  customFields: OrderFormCustomFieldApi[];
}

interface OrderFormCustomFieldApi {
  id: string | number;
  configId: string | number;
  fieldKey: string;
  label: string;
  fieldType: string;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
  showInOrderList: boolean;
  showInOrderDetail: boolean;
  placeholder: string;
  helperText: string;
  validationRulesJson?: string;
  options: OrderFormFieldOptionApi[];
}

interface OrderFormFieldOptionApi {
  id: string | number;
  label: string;
  value: string;
  sortOrder: number;
  isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class OrderFormTemplateService {
  private readonly httpService = inject(HttpService);
  private readonly authStore = inject(AuthStore);
  private readonly shopSetupStatusService = inject(ShopSetupStatusService);
  private readonly endpoint = API_ENDPOINTS.orderFormTemplates;

  private readonly templatesState = signal<OrderFormTemplate[]>([]);
  private readonly loadingState = signal(false);

  readonly templates = this.templatesState.asReadonly();
  readonly loading = this.loadingState.asReadonly();

  constructor() {
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.loadingState.set(true);
    this.loadConfig('SELL');
    this.loadConfig('RENT');
    this.loadingState.set(false);
  }

  loadConfig(type: OrderFormTemplateType): void {
    this.httpService
      .get<OrderFormConfigApi | ApiEnvelope<OrderFormConfigApi>>(`${this.endpoint}/${type}`)
      .pipe(map((response) => normalizeConfig(unwrapApiResponse(response))))
      .subscribe({
        next: (template) => {
          this.replaceTemplate(template);
          this.refreshShopSetupStatus();
        }
      });
  }

  getTemplateByType(type: OrderFormTemplateType): OrderFormTemplate {
    const template = this.templatesState().find(t => t.templateType === type);

    if (!template) {
      return {
        id: `virtual-${type.toLowerCase()}`,
        templateType: type,
        name: `Cấu hình đơn ${type}`,
        status: 'ACTIVE',
        fieldCount: 0,
        updatedAt: new Date().toISOString(),
        fields: []
      };
    }

    return template;
  }

  addField(type: OrderFormTemplateType, input: {
    label: string;
    type: OrderFormFieldType;
    placeholder?: string;
    required?: boolean;
    helperText?: string;
    showInOrderList?: boolean;
    showInOrderDetail?: boolean;
    options?: OrderFormFieldOption[];
    validationRulesJson?: string;
  }): Observable<OrderFormTemplateField> {
    return this.httpService
      .post<OrderFormCustomFieldApi | ApiEnvelope<OrderFormCustomFieldApi>, Record<string, unknown>>(
        `${this.endpoint}/${type}/fields`,
        {
          label: input.label,
          fieldType: input.type,
          placeholder: input.placeholder ?? '',
          helperText: input.helperText ?? '',
          isRequired: input.required ?? false,
          showInOrderList: input.showInOrderList ?? false,
          showInOrderDetail: input.showInOrderDetail ?? true,
          validationRulesJson: input.validationRulesJson,
          options: input.options?.map(o => ({
            label: o.label,
            value: o.value || o.label,
            sortOrder: o.sortOrder,
            isActive: o.active
          }))
        }
      )
      .pipe(
        map((response) => normalizeField(unwrapApiResponse(response), '0')),
        tap((field) => {
          this.templatesState.update((templates) =>
            templates.map((templateItem) => {
              if (templateItem.templateType !== type) {
                return templateItem;
              }

              const nextFields = [...templateItem.fields, field];
              return {
                ...templateItem,
                updatedAt: new Date().toISOString(),
                fieldCount: nextFields.filter((item) => item.active).length,
                fields: nextFields
              };
            })
          );
        })
      );
  }

  updateField(
    type: OrderFormTemplateType,
    fieldId: string,
    patch: Partial<Omit<OrderFormTemplateField, 'id' | 'templateId'>>
  ): Observable<OrderFormTemplateField> {
    return this.httpService
      .put<OrderFormCustomFieldApi | ApiEnvelope<OrderFormCustomFieldApi>, Record<string, unknown>>(
        `${this.endpoint}/${type}/fields/${fieldId}`,
        {
          fieldKey: patch.fieldKey,
          label: patch.label,
          fieldType: patch.type,
          placeholder: patch.placeholder,
          helperText: patch.helperText,
          isRequired: patch.required,
          isActive: patch.active,
          sortOrder: patch.sortOrder,
          showInOrderList: patch.showInOrderList,
          showInOrderDetail: patch.showInOrderDetail,
          validationRulesJson: patch.validationRules ? JSON.stringify(patch.validationRules) : undefined,
          options: patch.options?.map(o => ({
            id: o.id && !o.id.startsWith('temp-') ? Number(o.id) : null,
            label: o.label,
            value: o.value || o.label,
            sortOrder: o.sortOrder,
            isActive: o.active
          }))
        }
      )
      .pipe(
        map((response) => normalizeField(unwrapApiResponse(response), '0')),
        tap((field) => {
          this.templatesState.update((templates) =>
            templates.map((template) => {
              if (template.templateType !== type) {
                return template;
              }

              return {
                ...template,
                updatedAt: new Date().toISOString(),
                fields: template.fields.map((item) => (item.id === field.id ? field : item))
              };
            })
          );
        })
      );
  }

  removeCustomField(type: OrderFormTemplateType, fieldId: string): Observable<void> {
    return this.httpService
      .delete<void | ApiEnvelope<void>>(`${this.endpoint}/${type}/fields/${fieldId}`)
      .pipe(
        map(() => undefined),
        tap(() => {
          this.templatesState.update((templates) =>
            templates.map((template) => {
              if (template.templateType !== type) {
                return template;
              }

              const nextFields = template.fields.filter((field) => field.id !== fieldId);
              return {
                ...template,
                updatedAt: new Date().toISOString(),
                fieldCount: nextFields.filter((field) => field.active).length,
                fields: nextFields
              };
            })
          );
        })
      );
  }

  private replaceTemplate(template: OrderFormTemplate): void {
    this.templatesState.update((current) => {
      const index = current.findIndex((item) => item.templateType === template.templateType);

      if (index < 0) {
        return [template, ...current];
      }

      const next = [...current];
      next[index] = template;
      return next;
    });
  }

  private refreshShopSetupStatus(): void {
    if (this.authStore.currentRole() === 'SHOP_OWNER' && this.authStore.currentShop()) {
      this.shopSetupStatusService.refresh();
    }
  }
}

function normalizeConfig(value: OrderFormConfigApi): OrderFormTemplate {
  const id = asString(value.id);
  const type = value.formType as OrderFormTemplateType;

  return {
    id,
    templateType: type,
    name: `Cấu hình đơn ${type}`,
    status: 'ACTIVE',
    fieldCount: (value.customFields ?? []).filter((field) => field.isActive !== false).length,
    updatedAt: value.updatedAt || new Date().toISOString(),
    fields: (value.customFields ?? []).map((field) => normalizeField(field, id))
  };
}

function normalizeField(value: OrderFormCustomFieldApi, templateIdFallback: string): OrderFormTemplateField {
  let validationRules: Record<string, unknown> = {};
  if (value.validationRulesJson) {
    try {
      validationRules = JSON.parse(value.validationRulesJson);
    } catch (e) {
      console.error('Error parsing validationRulesJson', e);
    }
  }

  return {
    id: asString(value.id),
    templateId: asString(value.configId ?? templateIdFallback),
    fieldKey: value.fieldKey?.trim() || '',
    label: value.label?.trim() || 'Trường mới',
    type: normalizeFieldType(value.fieldType),
    placeholder: value.placeholder?.trim() || '',
    helperText: value.helperText?.trim() || '',
    required: Boolean(value.isRequired ?? false),
    active: value.isActive !== false,
    sortOrder: typeof value.sortOrder === 'number' ? value.sortOrder : 0,
    showInOrderList: Boolean(value.showInOrderList ?? false),
    showInOrderDetail: value.showInOrderDetail !== false,
    validationRules,
    options: (value.options ?? []).map((option) => normalizeOption(option))
  };
}

function normalizeOption(value: OrderFormFieldOptionApi): OrderFormFieldOption {
  return {
    id: asString(value.id),
    label: value.label?.trim() || '',
    value: value.value?.trim() || value.label?.trim() || '',
    sortOrder: typeof value.sortOrder === 'number' ? value.sortOrder : 0,
    active: value.isActive !== false
  };
}

function normalizeFieldType(value: unknown): OrderFormFieldType {
  switch (value) {
    case 'text':
    case 'email':
    case 'phone':
    case 'textarea':
    case 'number':
    case 'date':
    case 'time':
    case 'single_choice':
    case 'multi_choice':
    case 'dropdown':
    case 'image':
      return value;
    default:
      return 'text';
  }
}

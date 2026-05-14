import { inject, Injectable, signal } from '@angular/core';
import { map, Observable, tap, of } from 'rxjs';
import { API_ENDPOINTS } from '../constants/app.constants';
import { HttpService } from '../http/http.service';
import {
  ProductFormFieldOption,
  ProductFormFieldType,
  ProductFormTemplate,
  ProductFormTemplateField,
  ProductFormTemplateType
} from '../models/product-form-template.model';
import { ApiEnvelope, asString, unwrapApiResponse } from '../utils/api-response.util';

interface ProductFormConfigApi {
  id: string | number;
  formType: string;
  createdAt: string;
  updatedAt: string;
  customFields: ProductFormCustomFieldApi[];
}

interface ProductFormCustomFieldApi {
  id: string | number;
  configId: string | number;
  fieldKey: string;
  label: string;
  fieldType: string;
  isRequired: boolean;
  isEnabled: boolean;
  sortOrder: number;
  placeholder: string;
  helperText: string;
  validationRulesJson?: string;
  options: ProductFormFieldOptionApi[];
}

interface ProductFormFieldOptionApi {
  id: string | number;
  label: string;
  value: string;
  sortOrder: number;
  isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProductFormTemplateService {
  private readonly httpService = inject(HttpService);
  private readonly endpoint = API_ENDPOINTS.productFormTemplates;

  private readonly templatesState = signal<ProductFormTemplate[]>([]);
  private readonly loadingState = signal(false);

  readonly templates = this.templatesState.asReadonly();
  readonly loading = this.loadingState.asReadonly();

  constructor() {
    this.loadTemplates();
  }

  loadTemplates(): void {
    this.loadingState.set(true);
    // Load both SELL and RENT configs
    this.loadConfig('SELL');
    this.loadConfig('RENT');
    // We don't have a bulk API yet, so we just set loading false after a while or when both complete
    // For simplicity, we just set it false here as the individual loads will update state
    this.loadingState.set(false);
  }

  loadConfig(type: ProductFormTemplateType): void {
    this.httpService
      .get<ProductFormConfigApi | ApiEnvelope<ProductFormConfigApi>>(`${this.endpoint}/${type}`)
      .pipe(map((response) => normalizeConfig(unwrapApiResponse(response))))
      .subscribe({
        next: (template) => this.replaceTemplate(template)
      });
  }

  getTemplateByType(type: ProductFormTemplateType): ProductFormTemplate {
    const template = this.templatesState().find(t => t.templateType === type);
    
    if (!template) {
      return {
        id: `virtual-${type.toLowerCase()}`,
        templateType: type,
        name: `Cấu hình ${type}`,
        status: 'ACTIVE',
        fieldCount: 0,
        updatedAt: new Date().toISOString(),
        fields: []
      };
    }

    return template;
  }

  addField(type: ProductFormTemplateType, input: {
    label: string;
    type: ProductFormFieldType;
    placeholder?: string;
    required?: boolean;
    helperText?: string;
    options?: ProductFormFieldOption[];
    validationRulesJson?: string;
  }): Observable<ProductFormTemplateField> {
    return this.httpService
      .post<ProductFormCustomFieldApi | ApiEnvelope<ProductFormCustomFieldApi>, Record<string, unknown>>(
        `${this.endpoint}/${type}/fields`,
        {
          label: input.label,
          fieldType: input.type,
          placeholder: input.placeholder ?? '',
          helperText: input.helperText ?? '',
          isRequired: input.required ?? false,
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
        // ... tap logic remains the same
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
                fieldCount: nextFields.filter((item) => item.enabled).length,
                fields: nextFields
              };
            })
          );
        })
      );
  }

  updateField(
    type: ProductFormTemplateType,
    fieldId: string,
    patch: Partial<Omit<ProductFormTemplateField, 'id' | 'templateId'>>
  ): Observable<ProductFormTemplateField> {
    return this.httpService
      .put<ProductFormCustomFieldApi | ApiEnvelope<ProductFormCustomFieldApi>, Record<string, unknown>>(
        `${this.endpoint}/${type}/fields/${fieldId}`,
        {
          fieldKey: patch.fieldKey,
          label: patch.label,
          fieldType: patch.type,
          placeholder: patch.placeholder,
          helperText: patch.helperText,
          isRequired: patch.required,
          isEnabled: patch.enabled,
          sortOrder: patch.sortOrder,
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

  removeCustomField(type: ProductFormTemplateType, fieldId: string): Observable<void> {
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
                fieldCount: nextFields.filter((field) => field.enabled).length,
                fields: nextFields
              };
            })
          );
        })
      );
  }

  addFieldOption(type: ProductFormTemplateType, fieldId: string, label = ''): Observable<ProductFormFieldOption> {
    return this.httpService
      .post<ProductFormFieldOptionApi | ApiEnvelope<ProductFormFieldOptionApi>, Record<string, unknown>>(
        `${this.endpoint}/${type}/fields/${fieldId}/options`,
        {
          label: label.trim() || `Lựa chọn mới`,
          value: label.trim() || `Lựa chọn mới`
        }
      )
      .pipe(
        map((response) => normalizeOption(unwrapApiResponse(response))),
        tap((option) => {
          this.templatesState.update((templates) =>
            templates.map((templateItem) => {
              if (templateItem.templateType !== type) {
                return templateItem;
              }

              return {
                ...templateItem,
                fields: templateItem.fields.map((fieldItem) => {
                  if (fieldItem.id !== fieldId) {
                    return fieldItem;
                  }

                  return {
                    ...fieldItem,
                    options: [...fieldItem.options, option]
                  };
                })
              };
            })
          );
        })
      );
  }

  updateFieldOption(
    type: ProductFormTemplateType,
    fieldId: string,
    optionId: string,
    label: string,
    value?: string
  ): Observable<ProductFormFieldOption> {
    return this.httpService
      .put<ProductFormFieldOptionApi | ApiEnvelope<ProductFormFieldOptionApi>, Record<string, unknown>>(
        `${this.endpoint}/${type}/fields/${fieldId}/options/${optionId}`,
        {
          label,
          value: value ?? label,
          isActive: true
        }
      )
      .pipe(
        map((response) => normalizeOption(unwrapApiResponse(response))),
        tap((option) => {
          this.templatesState.update((templates) =>
            templates.map((template) => {
              if (template.templateType !== type) {
                return template;
              }

              return {
                ...template,
                fields: template.fields.map((fieldItem) => {
                  if (fieldItem.id !== fieldId) {
                    return fieldItem;
                  }

                  return {
                    ...fieldItem,
                    options: fieldItem.options.map((item) => (item.id === optionId ? option : item))
                  };
                })
              };
            })
          );
        })
      );
  }

  removeFieldOption(type: ProductFormTemplateType, fieldId: string, optionId: string): Observable<void> {
    return this.httpService
      .delete<void | ApiEnvelope<void>>(`${this.endpoint}/${type}/fields/${fieldId}/options/${optionId}`)
      .pipe(
        map(() => undefined),
        tap(() => {
          this.templatesState.update((templates) =>
            templates.map((template) => {
              if (template.templateType !== type) {
                return template;
              }

              return {
                ...template,
                fields: template.fields.map((fieldItem) => {
                  if (fieldItem.id !== fieldId) {
                    return fieldItem;
                  }

                  return {
                    ...fieldItem,
                    options: fieldItem.options.filter((item) => item.id !== optionId)
                  };
                })
              };
            })
          );
        })
      );
  }

  private replaceTemplate(template: ProductFormTemplate): void {
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
}

function normalizeConfig(value: ProductFormConfigApi): ProductFormTemplate {
  const id = asString(value.id);
  const type = value.formType as ProductFormTemplateType;

  return {
    id,
    templateType: type,
    name: `Cấu hình ${type}`,
    status: 'ACTIVE',
    fieldCount: (value.customFields ?? []).filter((field) => field.isEnabled !== false).length,
    updatedAt: value.updatedAt || new Date().toISOString(),
    fields: (value.customFields ?? []).map((field) => normalizeField(field, id))
  };
}

function normalizeField(value: ProductFormCustomFieldApi, templateIdFallback: string): ProductFormTemplateField {
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
    enabled: value.isEnabled !== false,
    sortOrder: typeof value.sortOrder === 'number' ? value.sortOrder : 0,
    validationRules,
    options: (value.options ?? []).map((option) => normalizeOption(option))
  };
}

function normalizeOption(value: ProductFormFieldOptionApi): ProductFormFieldOption {
  return {
    id: asString(value.id),
    label: value.label?.trim() || '',
    value: value.value?.trim() || value.label?.trim() || '',
    sortOrder: typeof value.sortOrder === 'number' ? value.sortOrder : 0,
    active: value.isActive !== false
  };
}

function normalizeFieldType(value: unknown): ProductFormFieldType {
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

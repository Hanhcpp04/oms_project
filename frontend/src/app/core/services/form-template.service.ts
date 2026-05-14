import { inject, Injectable, signal } from '@angular/core';
import { map, Observable, tap } from 'rxjs';
import { API_ENDPOINTS } from '../constants/app.constants';
import { HttpService } from '../http/http.service';
import {
  FormFieldOption,
  FormFieldSemanticKey,
  FormFieldType,
  FormTemplate,
  FormTemplateCategory,
  FormTemplateField,
  FormTemplateFieldInput,
  FormTemplateInput,
  FormTemplateMemberPermission,
  FormTemplatePermission,
  FormTemplateSharing,
  FormTemplateStatus,
  FormTemplateType
} from '../models/form-template.model';
import { ApiEnvelope, asString, isRecord, unwrapApiResponse } from '../utils/api-response.util';

interface FormTemplateApi {
  id?: string | number;
  name?: string;
  description?: string;
  formType?: string;
  category?: string;
  status?: string;
  isPublic?: boolean;
  publicSlug?: string;
  versionNo?: number;
  createdAt?: string;
  updatedAt?: string;
  fields?: FormTemplateFieldApi[];
}

interface FormTemplateFieldApi {
  id?: string | number;
  templateId?: string | number;
  fieldKey?: string;
  label?: string;
  fieldType?: string;
  semanticKey?: string;
  placeholder?: string;
  helperText?: string;
  defaultValue?: string;
  isRequired?: boolean;
  isActive?: boolean;
  showInOrderList?: boolean;
  showInOrderDetail?: boolean;
  sortOrder?: number;
  validationRules?: unknown;
  options?: FormTemplateFieldOptionApi[];
}

interface FormTemplateFieldOptionApi {
  id?: string | number;
  label?: string;
  value?: string;
  sortOrder?: number;
  isActive?: boolean;
}

interface ReorderFieldPayload {
  items: Array<{ fieldId: number; sortOrder: number }>;
}

@Injectable({ providedIn: 'root' })
export class FormTemplateService {
  private readonly httpService = inject(HttpService);
  private readonly endpoint = API_ENDPOINTS.formTemplates;

  private readonly templatesState = signal<FormTemplate[]>([]);
  private readonly loadingState = signal(false);

  readonly templates = this.templatesState.asReadonly();
  readonly loading = this.loadingState.asReadonly();

  constructor() {
    this.loadTemplates();
  }

  loadTemplates(params?: { formType?: FormTemplateType; status?: FormTemplateStatus; category?: FormTemplateCategory }): void {
    this.loadingState.set(true);

    this.httpService
      .get<FormTemplateApi[] | ApiEnvelope<FormTemplateApi[]>>(this.endpoint, {
        params: {
          formType: params?.formType,
          status: params?.status,
          category: params?.category
        }
      })
      .pipe(map((response) => unwrapApiResponse(response)))
      .subscribe({
        next: (templates) => {
          const normalizedTemplates = (templates ?? []).map((item) => normalizeTemplate(item));
          this.templatesState.set(normalizedTemplates);
          normalizedTemplates.forEach((template) => this.loadTemplateDetail(template.id));
          this.loadingState.set(false);
        },
        error: () => {
          this.loadingState.set(false);
        }
      });
  }

  getTemplateById(templateId: string): FormTemplate | null {
    return this.templatesState().find((template) => template.id === templateId) ?? null;
  }

  loadTemplateDetail(templateId: string): void {
    this.httpService
      .get<FormTemplateApi | ApiEnvelope<FormTemplateApi>>(`${this.endpoint}/${templateId}`)
      .pipe(map((response) => normalizeTemplate(unwrapApiResponse(response))))
      .subscribe({
        next: (template) => this.replaceTemplate(template)
      });
  }

  getTemplateByCategory(category: 'rent' | 'sell'): FormTemplate | null {
    const candidates = this.templatesState()
      .filter((template) => template.category === category && template.status !== 'ARCHIVED')
      .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));

    return candidates[0] ?? null;
  }

  createNewTemplate(name: string, category: 'rent' | 'sell' | 'general'): Observable<FormTemplate> {
    return this.createTemplate({
      name,
      description: '',
      formType: 'PUBLIC',
      category,
      isPublic: true
    });
  }

  createTemplate(input: FormTemplateInput): Observable<FormTemplate> {
    return this.httpService
      .post<FormTemplateApi | ApiEnvelope<FormTemplateApi>, Record<string, unknown>>(this.endpoint, {
        name: input.name,
        description: input.description ?? '',
        formType: input.formType ?? 'PUBLIC',
        category: input.category ?? 'sell',
        isPublic: input.isPublic ?? true
      })
      .pipe(
        map((response) => normalizeTemplate(unwrapApiResponse(response))),
        tap((template) => {
          this.templatesState.update((current) => [template, ...current]);
        })
      );
  }

  removeTemplate(templateId: string): Observable<FormTemplate> {
    return this.httpService
      .put<FormTemplateApi | ApiEnvelope<FormTemplateApi>, Record<string, unknown>>(`${this.endpoint}/${templateId}`, {
        status: 'ARCHIVED'
      })
      .pipe(
        map((response) => normalizeTemplate(unwrapApiResponse(response))),
        tap((template) => this.replaceTemplate(template))
      );
  }

  updateTemplateDetails(templateId: string, patch: { name?: string; description?: string }): Observable<FormTemplate> {
    return this.httpService
      .put<FormTemplateApi | ApiEnvelope<FormTemplateApi>, Record<string, unknown>>(`${this.endpoint}/${templateId}`, patch)
      .pipe(
        map((response) => normalizeTemplate(unwrapApiResponse(response))),
        tap((template) => this.replaceTemplate(template))
      );
  }

  updateTemplateStatus(templateId: string, patch: { status?: FormTemplateStatus; isPublic?: boolean }): Observable<FormTemplate> {
    return this.httpService
      .put<FormTemplateApi | ApiEnvelope<FormTemplateApi>, Record<string, unknown>>(`${this.endpoint}/${templateId}`, patch)
      .pipe(
        map((response) => normalizeTemplate(unwrapApiResponse(response))),
        tap((template) => this.replaceTemplate(template))
      );
  }

  duplicateTemplate(templateId: string): Observable<FormTemplate> {
    return this.httpService
      .post<FormTemplateApi | ApiEnvelope<FormTemplateApi>, Record<string, never>>(`${this.endpoint}/${templateId}/duplicate`, {})
      .pipe(
        map((response) => normalizeTemplate(unwrapApiResponse(response))),
        tap((template) => {
          this.templatesState.update((current) => [template, ...current]);
        })
      );
  }

  addField(templateId: string, input: FormTemplateFieldInput & { options?: FormFieldOption[] }, insertAfterId?: string | null): Observable<FormTemplateField> {
    const template = this.getTemplateById(templateId);
    const sortOrder = resolveNextSortOrder(template?.fields ?? [], insertAfterId ?? null);

    return this.httpService
      .post<FormTemplateFieldApi | ApiEnvelope<FormTemplateFieldApi>, Record<string, unknown>>(
        `${this.endpoint}/${templateId}/fields`,
        {
          label: input.label,
          fieldType: input.type,
          semanticKey: input.semanticKey ?? null,
          placeholder: input.placeholder ?? '',
          helperText: input.helperText ?? '',
          defaultValue: input.defaultValue ?? '',
          isRequired: input.required ?? false,
          showInOrderList: input.showInOrderList ?? false,
          showInOrderDetail: input.showInOrderDetail ?? true,
          sortOrder,
          options: input.options?.map(o => ({
            label: o.label,
            value: o.value || o.label,
            sortOrder: o.sortOrder,
            isActive: o.active
          }))
        }
      )
      .pipe(
        map((response) => normalizeField(unwrapApiResponse(response), templateId)),
        tap((field) => {
          this.templatesState.update((templates) =>
            templates.map((templateItem) => {
              if (templateItem.id !== templateId) {
                return templateItem;
              }

              const nextFields = insertFieldAtPosition(templateItem.fields, field, insertAfterId ?? null);
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

  updateField(templateId: string, fieldId: string, patch: Partial<FormTemplateField>): Observable<FormTemplateField> {
    return this.httpService
      .put<FormTemplateFieldApi | ApiEnvelope<FormTemplateFieldApi>, Record<string, unknown>>(
        `${this.endpoint}/${templateId}/fields/${fieldId}`,
        {
          fieldKey: patch.fieldKey,
          label: patch.label,
          fieldType: patch.type,
          semanticKey: patch.semanticKey ?? null,
          placeholder: patch.placeholder,
          helperText: patch.helperText,
          defaultValue: patch.defaultValue,
          isRequired: patch.required,
          isActive: patch.active,
          showInOrderList: patch.showInOrderList,
          showInOrderDetail: patch.showInOrderDetail,
          sortOrder: patch.sortOrder,
          validationRules: patch.validationRules,
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
        map((response) => normalizeField(unwrapApiResponse(response), templateId)),
        tap((field) => this.replaceField(templateId, field))
      );
  }

  updateTemplateSharing(templateId: string, sharing: FormTemplateSharing): void {
    this.templatesState.update((templates) =>
      templates.map((template) => {
        if (template.id !== templateId) {
          return template;
        }

        return {
          ...template,
          sharing: normalizeTemplateSharing(sharing)
        };
      })
    );
  }

  addFieldOption(templateId: string, fieldId: string, label = ''): Observable<FormFieldOption> {
    const field = this.getTemplateById(templateId)?.fields.find((item) => item.id === fieldId) ?? null;
    const sortOrder = (field?.options.length ?? 0) + 1;

    return this.httpService
      .post<FormTemplateFieldOptionApi | ApiEnvelope<FormTemplateFieldOptionApi>, Record<string, unknown>>(
        `${this.endpoint}/${templateId}/fields/${fieldId}/options`,
        {
          label: label.trim() || `Lua chon ${sortOrder}`,
          value: label.trim() || `Lua chon ${sortOrder}`,
          sortOrder
        }
      )
      .pipe(
        map((response) => normalizeOption(unwrapApiResponse(response))),
        tap((option) => {
          this.templatesState.update((templates) =>
            templates.map((template) => {
              if (template.id !== templateId) {
                return template;
              }

              return {
                ...template,
                updatedAt: new Date().toISOString(),
                fields: template.fields.map((fieldItem) => {
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

  updateFieldOption(templateId: string, fieldId: string, optionId: string, label: string): Observable<FormFieldOption> {
    const field = this.getTemplateById(templateId)?.fields.find((item) => item.id === fieldId) ?? null;
    const currentOption = field?.options.find((item) => item.id === optionId) ?? null;

    return this.httpService
      .put<FormTemplateFieldOptionApi | ApiEnvelope<FormTemplateFieldOptionApi>, Record<string, unknown>>(
        `${this.endpoint}/${templateId}/fields/${fieldId}/options/${optionId}`,
        {
          label,
          value: label,
          sortOrder: currentOption?.sortOrder ?? 0,
          isActive: true
        }
      )
      .pipe(
        map((response) => normalizeOption(unwrapApiResponse(response))),
        tap((option) => {
          this.templatesState.update((templates) =>
            templates.map((template) => {
              if (template.id !== templateId) {
                return template;
              }

              return {
                ...template,
                updatedAt: new Date().toISOString(),
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

  removeFieldOption(templateId: string, fieldId: string, optionId: string): Observable<void> {
    return this.httpService
      .delete<void | ApiEnvelope<void>>(`${this.endpoint}/${templateId}/fields/${fieldId}/options/${optionId}`)
      .pipe(
        map(() => undefined),
        tap(() => {
          this.templatesState.update((templates) =>
            templates.map((template) => {
              if (template.id !== templateId) {
                return template;
              }

              return {
                ...template,
                updatedAt: new Date().toISOString(),
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

  removeField(templateId: string, fieldId: string): Observable<void> {
    return this.httpService
      .delete<void | ApiEnvelope<void>>(`${this.endpoint}/${templateId}/fields/${fieldId}`)
      .pipe(
        map(() => undefined),
        tap(() => {
          this.templatesState.update((templates) =>
            templates.map((template) => {
              if (template.id !== templateId) {
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

  moveField(templateId: string, fieldId: string, direction: 'up' | 'down'): Observable<FormTemplateField[]> {
    const template = this.getTemplateById(templateId);

    if (!template) {
      return new Observable<FormTemplateField[]>((subscriber) => {
        subscriber.next([]);
        subscriber.complete();
      });
    }

    const currentIndex = template.fields.findIndex((field) => field.id === fieldId);
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= template.fields.length) {
      return new Observable<FormTemplateField[]>((subscriber) => {
        subscriber.next(template.fields);
        subscriber.complete();
      });
    }

    const nextFields = [...template.fields];
    const [movedField] = nextFields.splice(currentIndex, 1);
    nextFields.splice(targetIndex, 0, movedField);

    return this.reorderFields(templateId, nextFields);
  }

  reorderFields(templateId: string, fieldsOrIndexes: FormTemplateField[] | { fromIndex: number; toIndex: number }): Observable<FormTemplateField[]> {
    const template = this.getTemplateById(templateId);

    if (!template) {
      return new Observable<FormTemplateField[]>((subscriber) => {
        subscriber.next([]);
        subscriber.complete();
      });
    }

    let orderedFields: FormTemplateField[];

    if (Array.isArray(fieldsOrIndexes)) {
      orderedFields = fieldsOrIndexes;
    } else {
      const { fromIndex, toIndex } = fieldsOrIndexes;
      orderedFields = [...template.fields];
      const [movedField] = orderedFields.splice(fromIndex, 1);
      orderedFields.splice(toIndex, 0, movedField);
    }

    const payload: ReorderFieldPayload = {
      items: orderedFields.map((field, index) => ({
        fieldId: Number(field.id),
        sortOrder: index + 1
      }))
    };

    return this.httpService
      .put<FormTemplateFieldApi[] | ApiEnvelope<FormTemplateFieldApi[]>, ReorderFieldPayload>(
        `${this.endpoint}/${templateId}/fields/reorder`,
        payload
      )
      .pipe(
        map((response) => unwrapApiResponse(response)),
        map((fields) => (fields ?? []).map((field) => normalizeField(field, templateId))),
        tap((fields) => {
          this.templatesState.update((templates) =>
            templates.map((templateItem) => {
              if (templateItem.id !== templateId) {
                return templateItem;
              }

              return {
                ...templateItem,
                updatedAt: new Date().toISOString(),
                fields
              };
            })
          );
        })
      );
  }

  private replaceTemplate(template: FormTemplate): void {
    this.templatesState.update((current) => {
      const index = current.findIndex((item) => item.id === template.id);

      if (index < 0) {
        return [template, ...current];
      }

      const next = [...current];
      next[index] = template;
      return next;
    });
  }

  private replaceField(templateId: string, field: FormTemplateField): void {
    this.templatesState.update((templates) =>
      templates.map((template) => {
        if (template.id !== templateId) {
          return template;
        }

        const nextFields = template.fields.map((item) => (item.id === field.id ? field : item));
        return {
          ...template,
          updatedAt: new Date().toISOString(),
          fields: nextFields
        };
      })
    );
  }
}

function normalizeTemplate(value: FormTemplateApi): FormTemplate {
  return {
    id: asString(value.id),
    name: value.name?.trim() || 'Mau khong co tieu de',
    description: value.description?.trim() || '',
    category: normalizeCategory(value.category),
    formType: normalizeFormType(value.formType),
    status: normalizeStatus(value.status),
    isPublic: Boolean(value.isPublic ?? false),
    publicSlug: value.publicSlug?.trim() || undefined,
    versionNo: typeof value.versionNo === 'number' ? value.versionNo : 1,
    isDefault: false,
    createdAt: value.createdAt || new Date().toISOString(),
    updatedAt: value.updatedAt || new Date().toISOString(),
    fields: (value.fields ?? []).map((field) => normalizeField(field, asString(value.id))),
    sharing: createDefaultTemplateSharing()
  };
}

function normalizeField(value: FormTemplateFieldApi, templateIdFallback: string): FormTemplateField {
  return {
    id: asString(value.id),
    templateId: asString(value.templateId ?? templateIdFallback),
    fieldKey: value.fieldKey?.trim() || '',
    label: value.label?.trim() || 'Truong moi',
    type: normalizeFieldType(value.fieldType),
    semanticKey: normalizeSemanticKey(value.semanticKey),
    placeholder: value.placeholder?.trim() || '',
    helperText: value.helperText?.trim() || '',
    defaultValue: value.defaultValue?.trim() || '',
    required: Boolean(value.isRequired ?? false),
    active: value.isActive !== false,
    showInOrderList: Boolean(value.showInOrderList ?? false),
    showInOrderDetail: value.showInOrderDetail !== false,
    sortOrder: typeof value.sortOrder === 'number' ? value.sortOrder : 0,
    validationRules: isRecord(value.validationRules) ? value.validationRules : undefined,
    options: (value.options ?? []).map((option) => normalizeOption(option))
  };
}

function normalizeOption(value: FormTemplateFieldOptionApi): FormFieldOption {
  return {
    id: asString(value.id),
    label: value.label?.trim() || '',
    value: value.value?.trim() || value.label?.trim() || '',
    sortOrder: typeof value.sortOrder === 'number' ? value.sortOrder : 0,
    active: value.isActive !== false
  };
}

function normalizeFormType(value: unknown): FormTemplateType {
  switch (value) {
    case 'PUBLIC':
    case 'ORDER_CAPTURE':
    case 'INTERNAL':
      return value;
    default:
      return 'PUBLIC';
  }
}

function normalizeCategory(value: unknown): FormTemplateCategory {
  switch (value) {
    case 'rent':
    case 'general':
      return value;
    default:
      return 'sell';
  }
}

function normalizeStatus(value: unknown): FormTemplateStatus {
  switch (value) {
    case 'PUBLISHED':
    case 'ARCHIVED':
      return value;
    default:
      return 'DRAFT';
  }
}

function normalizeFieldType(value: unknown): FormFieldType {
  switch (value) {
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

function normalizeSemanticKey(value: unknown): FormFieldSemanticKey | undefined {
  switch (value) {
    case 'customerName':
    case 'customerPhone':
    case 'customerAddress':
    case 'note':
    case 'slaHours':
    case 'rentFrom':
    case 'rentTo':
    case 'depositAmount':
    case 'productName':
    case 'productQuantity':
    case 'orderType':
    case 'shippingMethod':
    case 'shippingFee':
    case 'sourceChannel':
      return value;
    default:
      return undefined;
  }
}

function resolveNextSortOrder(fields: FormTemplateField[], insertAfterId: string | null): number {
  if (!insertAfterId) {
    return fields.length + 1;
  }

  const index = fields.findIndex((field) => field.id === insertAfterId);
  return index < 0 ? fields.length + 1 : index + 2;
}

function insertFieldAtPosition(fields: FormTemplateField[], field: FormTemplateField, insertAfterId: string | null): FormTemplateField[] {
  if (!insertAfterId) {
    return [...fields, field];
  }

  const index = fields.findIndex((item) => item.id === insertAfterId);

  if (index < 0) {
    return [...fields, field];
  }

  const nextFields = [...fields];
  nextFields.splice(index + 1, 0, field);
  return nextFields;
}

function createDefaultTemplateSharing(): FormTemplateSharing {
  return {
    defaultPermission: 'view',
    memberPermissions: []
  };
}

function normalizePermission(value: unknown): FormTemplatePermission {
  return value === 'edit' ? 'edit' : 'view';
}

function normalizeMemberPermission(value: unknown): FormTemplateMemberPermission | null {
  if (!isRecord(value)) {
    return null;
  }

  const userId = asString(value['userId']).trim();

  if (!userId) {
    return null;
  }

  return {
    userId,
    permission: normalizePermission(value['permission'])
  };
}

function normalizeTemplateSharing(value: unknown): FormTemplateSharing {
  if (!isRecord(value)) {
    return createDefaultTemplateSharing();
  }

  const defaultPermission = normalizePermission(value['defaultPermission']);
  const rawMemberPermissions = Array.isArray(value['memberPermissions']) ? value['memberPermissions'] : [];

  return {
    defaultPermission,
    memberPermissions: rawMemberPermissions
      .map((item) => normalizeMemberPermission(item))
      .filter((item): item is FormTemplateMemberPermission => item !== null)
  };
}
